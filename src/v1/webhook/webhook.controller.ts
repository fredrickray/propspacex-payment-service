import { PaymentService } from "@/v1/payment/payment.service";
import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { Request } from "express";

@Controller({
  path: 'webhooks',
  version: '1',
})
export class WebhookController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post('/paystack')
  @HttpCode(200)
  async handlePaystackWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string,
    @Body() body: unknown,
  ) {
    const payloadJson = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    const event = typeof body === 'object' && body && 'event' in body ? String((body as { event?: unknown }).event ?? '') : '';
    const response = await this.paymentService.handleProviderWebhook({
      provider: 'paystack',
      signature: signature ?? '',
      event,
      payloadJson,
    });
    return { message: response.message };
  }
}