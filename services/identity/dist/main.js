"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./filters/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.enableCors({
        origin: ['http://localhost:3000', 'http://localhost:3001', /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/],
        credentials: true,
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('EdAI Unified API')
        .setDescription('Single API server for EdAI ERP — all frontend contracts')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    await app.listen(process.env['PORT'] ?? 3001);
    console.log(`EdAI API server running on port ${process.env['PORT'] ?? 3001}`);
    console.log(`Swagger docs at http://localhost:${process.env['PORT'] ?? 3001}/docs`);
}
void bootstrap();
//# sourceMappingURL=main.js.map