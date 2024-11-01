import type { Attribute, Schema } from '@strapi/strapi';

export interface ContactAddress extends Schema.Component {
  collectionName: 'components_contact_addresses';
  info: {
    description: '';
    displayName: 'Address';
  };
  attributes: {
    city: Attribute.String;
    state: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 2;
      }>;
    street: Attribute.String;
    type: Attribute.String & Attribute.DefaultTo<'primary'>;
    zip: Attribute.BigInteger;
  };
}

export interface ContactPhone extends Schema.Component {
  collectionName: 'components_contact_phones';
  info: {
    displayName: 'Phone';
    icon: 'phone';
  };
  attributes: {
    number: Attribute.BigInteger;
    type: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'contact.address': ContactAddress;
      'contact.phone': ContactPhone;
    }
  }
}
