import React from 'react';
import { Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language?.split('-')[0] || 'ru';

  const changeLanguage = async (lang: string) => {
    localStorage.setItem('i18nextLng', lang);
    await i18n.changeLanguage(lang);
  };

  return (
    <Form.Select
      size="sm"
      value={currentLanguage}
      onChange={(e) => changeLanguage(e.target.value)}
      style={{ width: 150, borderRadius: 12 }}
    >
      <option value="ru">🇷🇺 Русский</option>
      <option value="en">🇬🇧 English</option>
      <option value="zh">🇨🇳 中文</option>
    </Form.Select>
  );
};

export default LanguageSwitcher;