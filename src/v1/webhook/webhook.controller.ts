import { Body, Controller, Headers, Post, Query } from "@nestjs/common";

@Controller({
  path: 'webhooks',
  version: '1',
})
export class WebhookController {
  constructor() { }

  @Post('/paystack')
  async handlePaystackWebhook(@Headers() headers: Headers, @Body() body: unknown, @Query() query: Record<string, unknown>) {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(body, headers, query);
    return { message: 'Webhook received' };
  }
}