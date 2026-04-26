"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const bootstrap_app_1 = require("./bootstrap-app");
async function bootstrap() {
    const app = await (0, bootstrap_app_1.createNestHttpApp)();
    const port = Number(process.env['PORT'] ?? 3001);
    await app.listen(port);
    console.log(`EdAI API server running on port ${port}`);
    console.log(`Swagger docs at http://localhost:${port}/docs`);
}
void bootstrap();
//# sourceMappingURL=main.js.map