#!/usr/bin/env python3
"""
ONNX Analyzer: родной Resize(256)+CenterCrop(224) как в train/Gradio
Показывает:
- исходное изображение
- то, что реально видит модель (после ресайза/кропа)
- saliency map по этому же входу
- вероятности сортов и спелости
"""

import onnx
import numpy as np
import matplotlib.pyplot as plt
import cv2
import argparse
import onnxruntime as ort
from scipy.ndimage import gaussian_filter
import warnings
warnings.filterwarnings('ignore')


# ----------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -----------------

def softmax(x):
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum(axis=0)


def torchvision_like_resize_center_crop(img_rgb, target_size=224, resize_short=256):
    """
    Эквивалент torchvision:
      transforms.Resize(256) + transforms.CenterCrop(224)
    - Resize по короткой стороне до resize_short с сохранением соотношения сторон
    - Центр-кроп квадратного фрагмента target_size x target_size
    """
    h, w = img_rgb.shape[:2]
    # 1) Resize короткой стороны до 256
    if h < w:
        new_h = resize_short
        new_w = int(w * resize_short / h)
    else:
        new_w = resize_short
        new_h = int(h * resize_short / w)
    img_resized = cv2.resize(img_rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # 2) CenterCrop 224x224
    h2, w2 = img_resized.shape[:2]
    start_y = (h2 - target_size) // 2
    start_x = (w2 - target_size) // 2
    img_cropped = img_resized[start_y:start_y + target_size,
                              start_x:start_x + target_size]

    return img_resized, img_cropped


def preprocess_for_onnx(img_rgb, target_size=224, resize_short=256):
    """
    Полный препроцессинг, совпадающий с PyTorch:
    Resize(256) + CenterCrop(224) + ToTensor + Normalize(ImageNet).
    Возвращает:
      - img_resized (после Resize)
      - img_cropped (после CenterCrop) – то, что видит модель
      - img_input (готовый тензор NCHW для ONNX)
    """
    img_resized, img_cropped = torchvision_like_resize_center_crop(
        img_rgb, target_size=target_size, resize_short=resize_short
    )

    # [0..255] -> [0..1]
    img_f = img_cropped.astype(np.float32) / 255.0

    # Нормализация как в torchvision (ImageNet)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_norm = (img_f - mean) / std

    # HWC -> CHW -> NCHW
    img_chw = np.transpose(img_norm, (2, 0, 1))
    img_input = img_chw[np.newaxis, ...]  # shape: (1,3,224,224)

    return img_resized, img_cropped, img_input


def full_saliency_map(img_cropped_rgb, model_path, input_name):
    """
    Occlusion-based saliency по всему 224x224.
    img_cropped_rgb – уже 224x224 RGB без нормализации.
    ВАЖНО: препроцессинг внутри тот же, что и при обычном инференсе.
    """
    session = ort.InferenceSession(model_path)

    h, w = img_cropped_rgb.shape[:2]
    assert (h, w) == (224, 224), "Ожидается уже центр-кроп 224x224"

    # Базовый препроцессинг для "оригинального" предсказания
    _, _, base_input = preprocess_for_onnx(img_cropped_rgb)

    # Вычисляем исходное предсказание для нормализации (опционально)
    base_outputs = session.run(None, {input_name: base_input})
    base_probs = softmax(base_outputs[0][0])  # сорт
    base_class = int(np.argmax(base_probs))

    print(f"🔍 Saliency для класса (sort index) = {base_class}")

    saliency = np.zeros((h, w), dtype=np.float32)

    # Маскируем блоками 8x8 для ускорения
    block = 8
    for y in range(0, h, block):
        for x in range(0, w, block):
            img_masked = img_cropped_rgb.copy()
            img_masked[y:y + block, x:x + block] = 0  # закрасим чёрным

            _, _, masked_input = preprocess_for_onnx(img_masked)
            outputs_masked = session.run(None, {input_name: masked_input})
            probs_masked = softmax(outputs_masked[0][0])

            # Потеря уверенности в базовом классе
            drop = base_probs[base_class] - probs_masked[base_class]
            saliency[y:y + block, x:x + block] = max(drop, 0.0)

    return saliency, base_class, base_probs


def analyze_model(model_path):
    """
    Простой анализ модели: кол-во слоёв, форма входа.
    """
    model = onnx.load(model_path)
    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name
    inp_shape = session.get_inputs()[0].shape

    print(" АНАЛИЗ МОДЕЛИ")
    print(f"  Вход: name={input_name}, shape={inp_shape}")
    print(f"  Кол-во узлов (слоёв графа): {len(model.graph.node)}")
    print(f"  Кол-во выходов: {len(session.get_outputs())}")

    return input_name


def visualize_complete_analysis(model_path, image_path, input_name):
    """
    Основная функция:
    - грузит изображение
    - делает тот же Resize+CenterCrop, что и в train/Gradio
    - прогоняет через ONNX
    - строит saliency map
    - рисует всё в один PDF/PNG
    """
    # ---- Загрузка исходного изображения ----
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise RuntimeError(f"Не удалось прочитать изображение: {image_path}")
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    print(f"\n📸 ОРИГИНАЛ: shape={img_rgb.shape} (H,W,C)")

    # ---- Препроцессинг как в PyTorch ----
    img_resized, img_cropped, img_input = preprocess_for_onnx(img_rgb)
    print(f" После Resize(256): {img_resized.shape}")
    print(f" После CenterCrop(224): {img_cropped.shape} (это видит модель)")

    # ---- Прогон через ONNX ----
    session = ort.InferenceSession(model_path)
    outputs = session.run(None, {input_name: img_input})

    # Предполагаем 2 выхода: [0] – сорт, [1] – спелость
    variety_logits = outputs[0][0]
    ripeness_logits = outputs[1][0]

    variety_probs = softmax(variety_logits)
    ripeness_probs = softmax(ripeness_logits)

    variety_labels = [
        "Bell Pepper", "Chile Pepper", "Cucumber Medium",
        "New Mexico Green Chile", "Potato Pink", "Potato Yellow",
        "Tomato Bull Heart", "Tomato Cherry Red"
    ]
    ripeness_labels = ["unripe", "half_ripe", "ripe", "spoiled"]

    variety_top = int(np.argmax(variety_probs))
    ripeness_top = int(np.argmax(ripeness_probs))

    print(f"орт: {variety_labels[variety_top]} ({variety_probs[variety_top]:.1%})")
    print(f" Спелость: {ripeness_labels[ripeness_top]} ({ripeness_probs[ripeness_top]:.1%})")

    # ---- Saliency Map (occlusion, тот же препроцессинг) ----
    print(" Считаем saliency map (occlusion)...")
    saliency, base_class, base_probs = full_saliency_map(img_cropped, model_path, input_name)

    saliency_smooth = gaussian_filter(saliency, sigma=2.0)
    vmax = np.percentile(saliency_smooth, 99)
    if vmax <= 0:
        vmax = saliency_smooth.max() if saliency_smooth.max() > 0 else 1.0

    heat = (saliency_smooth * 255.0 / vmax).clip(0, 255).astype(np.uint8)
    heat_color = cv2.applyColorMap(heat, cv2.COLORMAP_JET)
    heat_color_rgb = cv2.cvtColor(heat_color, cv2.COLOR_BGR2RGB)
    overlay = cv2.addWeighted(img_cropped, 0.6, heat_color_rgb, 0.4, 0)

    # ---- Визуализация ----
    fig, axes = plt.subplots(3, 3, figsize=(18, 14))
    fig.suptitle("ONNX Analyzer – родной Resize(256)+CenterCrop(224)", fontsize=18)

    # 1 строка: исходное, после Resize, то что видит модель (CenterCrop)
    axes[0, 0].imshow(img_rgb)
    axes[0, 0].set_title("1. Оригинал")
    axes[0, 0].axis("off")

    axes[0, 1].imshow(img_resized)
    axes[0, 1].set_title("2. После Resize(256)\n(как в torchvision)")
    axes[0, 1].axis("off")

    axes[0, 2].imshow(img_cropped)
    axes[0, 2].set_title("3. CenterCrop(224x224)\nЭТО видит модель")
    axes[0, 2].axis("off")

    # 2 строка: каналы cropped
    axes[1, 0].imshow(img_cropped[:, :, 0], cmap="Reds")
    axes[1, 0].set_title("R канал (224x224)")
    axes[1, 0].axis("off")

    axes[1, 1].imshow(img_cropped[:, :, 1], cmap="Greens")
    axes[1, 1].set_title("G канал")
    axes[1, 1].axis("off")

    axes[1, 2].imshow(img_cropped[:, :, 2], cmap="Blues")
    axes[1, 2].set_title("B канал")
    axes[1, 2].axis("off")

    # 3 строка: saliency + overlay + бар‑графики
    axes[2, 0].imshow(saliency_smooth, cmap="jet", vmin=0, vmax=vmax)
    axes[2, 0].set_title("Saliency Map (occlusion)")
    axes[2, 0].axis("off")

    axes[2, 1].imshow(overlay)
    axes[2, 1].set_title("Что модель 'видела' (overlay)")
    axes[2, 1].axis("off")

    # Бар‑граф сортов
    axes[2, 2].bar(range(len(variety_labels)), variety_probs, color="coral")
    axes[2, 2].set_xticks(range(len(variety_labels)))
    axes[2, 2].set_xticklabels(variety_labels, rotation=45, ha="right")
    axes[2, 2].set_ylim(0, 1)
    axes[2, 2].set_title(
        f"Сорт: {variety_labels[variety_top]} ({variety_probs[variety_top]:.1%})\n"
        f"Спелость: {ripeness_labels[ripeness_top]} ({ripeness_probs[ripeness_top]:.1%})"
    )

    plt.tight_layout()
    out_name = "onnx_resize_center_crop_analysis.png"
    plt.savefig(out_name, dpi=150, bbox_inches="tight")
    plt.show()

    print(f" Сохранено: {out_name}")


# ----------------- CLI -----------------

def main():
    parser = argparse.ArgumentParser(description="ONNX Analyzer with native Resize+CenterCrop")
    parser.add_argument("model_path", help="Путь к ONNX модели (multitask)")
    parser.add_argument("--image", required=True, help="Путь к тестовому изображению")
    args = parser.parse_args()

    input_name = analyze_model(args.model_path)
    visualize_complete_analysis(args.model_path, args.image, input_name)


if __name__ == "__main__":
    main()
