import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { Express } from 'express';

export function setupSwagger(app: Express) {
  // Загружаем YAML файл
  const swaggerYamlPath = path.join(__dirname, 'swagger.yaml');
  const swaggerDocument = YAML.load(swaggerYamlPath);

  // Настраиваем Swagger UI
  const options = {
    explorer: true, // Включаем поиск
    customSiteTitle: "AgroLand API Documentation",
    swaggerOptions: {
      persistAuthorization: true, // Сохраняем авторизацию
      displayRequestDuration: true, // Показываем время запроса
      docExpansion: 'list', // Сворачиваем все секции
      filter: true, // Включаем фильтр
      tryItOutEnabled: true, // Включаем "Try it out"
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { 
        color: #2c3e50; 
        font-size: 36px;
        font-weight: bold;
        margin-bottom: 20px;
      }
      .swagger-ui .info .description {
        font-size: 16px;
        line-height: 1.6;
      }
      .opblock-tag {
        font-size: 20px !important;
        font-weight: bold !important;
        color: #3498db !important;
        border-bottom: 2px solid #3498db !important;
        padding-bottom: 5px !important;
      }
      .scheme-container {
        display: none;
      }
      .btn.authorize {
        background-color: #27ae60 !important;
      }
    `,
    customfavIcon: '/favicon.ico',
  };

  // Добавляем Swagger UI в приложение
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));

  console.log('swagger UI доступен по адресу: http://localhost:5000/api-docs');
  console.log('OpenAPI спецификация: http://localhost:5000/api-docs.json');
}