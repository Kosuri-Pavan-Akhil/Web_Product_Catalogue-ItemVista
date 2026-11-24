import type { SendEnquiryMail } from '../integrations/smtp-mailer.js';
import type { CatalogueService } from './catalogue.service.js';

export interface Enquiry {
  productIds: number[];
  name: string;
  email: string;
  question?: string;
}

export class EnquiryDeliveryUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Enquiry email delivery is currently unavailable', { cause });
  }
}

export function createEnquiryService(catalogue: CatalogueService, sendMail: SendEnquiryMail) {
  return {
    async submit(enquiry: Enquiry) {
      const products = enquiry.productIds.length === 1
        ? [await catalogue.getProduct(enquiry.productIds[0])]
        : await catalogue.getProductsByIds(enquiry.productIds);
      const [firstProduct] = products;
      const customer = enquiry.name + ' (' + enquiry.email + ')';
      const interest = products.length === 1
        ? [customer + ' is interested in ' + firstProduct.title + '.', 'Product ID: ' + firstProduct.id]
        : [
          customer + ' is interested in these products:',
          ...products.map(product => '- ' + product.title + ' (Product ID: ' + product.id + ')'),
        ];
      const message = {
        subject: 'New ItemVista enquiry: ' + (products.length === 1 ? firstProduct.title : products.length + ' products'),
        replyTo: enquiry.email,
        text: [
          'Hi Sales team,',
          '',
          ...interest,
          ...(enquiry.question ? ['', 'Customer question:', enquiry.question] : []),
          '',
          'Please reply to this message to follow up with the customer.',
          '',
          'ItemVista',
        ].join('\n'),
      };

      try {
        await sendMail(message);
      } catch (error) {
        throw new EnquiryDeliveryUnavailableError(error);
      }
    },
  };
}

export type EnquiryService = ReturnType<typeof createEnquiryService>;
