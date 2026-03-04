import { WebhookController } from "@/v1/webhook/webhook.controller";
import { Module } from "@nestjs/common";

@Module({
  controllers: [WebhookController],
  exports: [WebhookModule],
})
export class WebhookModule { }