import gradio as gr
import torch
import torch.nn.functional as F
from torchvision import transforms
import timm
import yaml
from pathlib import Path
import numpy as np
from PIL import Image
import warnings
warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).parent
MODEL_PATH = PROJECT_ROOT / "models" / "variety_efficientnet_b0.pth" 
CLASS_MAPPING = PROJECT_ROOT  /"class_mapping.yaml"
EXAMPLE_IMAGES_DIR = PROJECT_ROOT / "data"  / "examples"  

print("Проверка файлов...")
print(f"Модель: {MODEL_PATH.exists()}")
print(f"Маппинг классов: {CLASS_MAPPING.exists()}")

with open(CLASS_MAPPING, 'r', encoding='utf-8') as f:
    idx_to_class = yaml.safe_load(f)

num_classes = len(idx_to_class)
print(f"Количество классов: {num_classes}")

transform = transforms.Compose([
    transforms.Resize((224, 224)),  
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                        std=[0.229, 0.224, 0.225]),
])

def load_model():
    """Загружаем обученную модель"""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Устройство: {device}")
    
    model = timm.create_model("efficientnet_b0", pretrained=False, num_classes=num_classes)
    
    # Загружаем веса
    state_dict = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()  # Режим inference
    
    print("Модель загружена успешно!")
    return model, device

model, device = load_model()

def predict(image):
    """Предсказание для одного изображения"""
    if image is None:
        return "Пожалуйста, загрузите изображение"
    
    try:
        # Конвертируем в PIL если нужно
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        
        # Применяем трансформации
        image_tensor = transform(image).unsqueeze(0).to(device)
        
        # Предсказание
        with torch.no_grad():
            outputs = model(image_tensor)
            probabilities = F.softmax(outputs, dim=1)
            
            top5_probs, top5_indices = torch.topk(probabilities, 5)
            
        # Форматируем результат
        results = []
        for i in range(top5_indices.shape[1]):
            class_idx = top5_indices[0, i].item()
            class_name = idx_to_class.get(str(class_idx), f"Класс {class_idx}")
            prob = top5_probs[0, i].item() * 100
            
            # Добавляем эмодзи для топ-1
            emoji = "1/" if i == 0 else "   "
            results.append(f"{emoji} {class_name}: {prob:.1f}%")
        
        # Топ-1 результат отдельно
        top1_idx = top5_indices[0, 0].item()
        top1_class = idx_to_class.get(str(top1_idx), f"Класс {top1_idx}")
        top1_prob = top5_probs[0, 0].item() * 100
        
        result_text = f" Результат: {top1_class} ({top1_prob:.1f}%)\n\n"
        result_text += "Топ-5 предсказаний:\n" + "\n".join(results)
        
        return result_text
        
    except Exception as e:
        return f"Ошибка: {str(e)}"

def batch_predict(images):
    """Предсказание для нескольких изображений"""
    if not images:
        return "Пожалуйста, загрузите изображения"
    
    results = []
    for i, image in enumerate(images):
        result = predict(image)
        results.append(f"Изображение {i+1}:\n{result}\n{'-'*40}")
    
    return "\n\n".join(results)

examples = []
if EXAMPLE_IMAGES_DIR.exists():
    example_files = list(EXAMPLE_IMAGES_DIR.glob("*.jpg")) + \
                    list(EXAMPLE_IMAGES_DIR.glob("*.jpeg")) + \
                    list(EXAMPLE_IMAGES_DIR.glob("*.png"))
    
    for img_path in example_files[:5]:  # Берем первые 5
        examples.append([str(img_path)])
    print(f"Найдено {len(examples)} примеров")
else:
    print("ℹПапка с примерами не найдена, примеры не загружены")

with gr.Blocks(title="Классификатор сортов", theme=gr.themes.Soft()) as demo:
    gr.Markdown("# Классификатор сортов")
    gr.Markdown(f"Модель обучена на {num_classes} классах с точностью 90%")
    
    with gr.Tab("Одно изображение"):
        with gr.Row():
            with gr.Column():
                input_image = gr.Image(
                    type="pil", 
                    label="Загрузите изображение растения",
                    height=300
                )
                predict_btn = gr.Button("Распознать", variant="primary")
                
            with gr.Column():
                output_text = gr.Markdown(label="Результат")
        
        # Примеры
        if examples:
            gr.Examples(
                examples=examples,
                inputs=[input_image],
                outputs=[output_text],
                fn=predict,
                cache_examples=True
            )
        
        predict_btn.click(fn=predict, inputs=input_image, outputs=output_text)
    
    with gr.Tab("Несколько изображений"):
        with gr.Row():
            with gr.Column():
                input_gallery = gr.Gallery(
                    label="Загрузите несколько изображений",
                    type="pil",
                    height=300
                )
                batch_predict_btn = gr.Button(" Распознать все", variant="primary")
                
            with gr.Column():
                batch_output = gr.Markdown(label="Результаты")
        
        batch_predict_btn.click(fn=batch_predict, inputs=input_gallery, outputs=batch_output)
    
    with gr.Tab("Информация о модели"):
        gr.Markdown("### Информация о модели")
        gr.Markdown(f"""
        - Архитектура: EfficientNet-B0
        - Количество классов: {num_classes}
        - Размер входного изображения: 224x224 пикселей
        - Точность на валидации: ~90%
        - Всего обученных эпох: 7
        """)
        
        # Показываем список классов
        classes_text = " Список классов:\n"
        for idx, class_name in sorted(idx_to_class.items(), key=lambda x: int(x[0])):
            classes_text += f"- {class_name}\n"
        
        gr.Markdown(classes_text)
    
    # Добавляем инструкции
    gr.Markdown("---")
    gr.Markdown("### Инструкция по использованию:")
    gr.Markdown("""
    1. Вкладка 'Одно изображение': Загрузите одно изображение растения
    2. Вкладка 'Несколько изображений': Загрузите несколько изображений сразу
    3. Нажмите кнопку 'Распознать' для получения предсказаний
    4. Результат: Модель покажет топ-5 наиболее вероятных классов с вероятностями
    """)

# Запуск приложения
if __name__ == "__main__":
    print("Запуск Gradio приложения...")
    print("Откройте http://localhost:7860 в браузере")
    
    demo.launch(
        server_name="0.0.0.0",  # Доступно со всех интерфейсов
        server_port=7860,
        share=False,  
        debug=False
    )