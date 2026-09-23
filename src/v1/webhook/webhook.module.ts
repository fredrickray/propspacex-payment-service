import { WebhookController } from "@/v1/webhook/webhook.controller";
import { PaymentModule } from "@/v1/payment/payment.module";
import { Module } from "@nestjs/common";

@Module({
  imports: [PaymentModule],
  controllers: [WebhookController],
  exports: [WebhookModule],
})
export class WebhookModule { }