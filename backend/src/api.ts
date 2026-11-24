import { createServer } from 'node:http';
import { createCatalogueController } from './controllers/catalogue.controller.js';
import { createEnquiryController } from './controllers/enquiry.controller.js';
import { RequestError, send } from './http/response.js';
import { createFakeStoreClient, ProductSourceError } from './integrations/fake-store.client.js';
import { createSmtpMailer } from './integrations/smtp-mailer.js';
import { createApiRoutes } from './routes/api.routes.js';
import { createCatalogueService, ProductNotFoundError } from './services/catalogue.service.js';
import { createEnquiryService, EnquiryDeliveryUnavailableError } from './services/enquiry.service.js';

export function createApi(source = createFakeStoreClient(), sendMail = createSmtpMailer()) {
  const catalogue = createCatalogueService(source);
  const enquiries = createEnquiryService(catalogue, sendMail);
  const route = createApiRoutes(createCatalogueController(catalogue), createEnquiryController(enquiries));

  return createServer(async (request, response) => {
    try {
      await route(request, response);
    } catch (error) {
      if (error instanceof RequestError) return send(response, error.status, { error: error.message });
      if (error instanceof ProductNotFoundError) return send(response, 404, { error: error.message });
      if (error instanceof EnquiryDeliveryUnavailableError) return send(response, 503, { error: error.message });
      if (error instanceof ProductSourceError) return send(response, 502, { error: 'Product source unavailable' });

      console.error('Unexpected API error', error);
      return send(response, 500, { error: 'Internal server error' });
    }
  });
}
