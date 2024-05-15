import type { Schema, Attribute } from '@strapi/strapi';

export interface ContactAddress extends Schema.Component {
  collectionName: 'components_contact_addresses';
  info: {
    displayName: 'Address';
    description: '';
  };
  attributes: {
    street: Attribute.String;
    city: Attribute.String;
    state: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 2;
      }>;
    zip: Attribute.BigInteger;
    type: Attribute.String & Attribute.DefaultTo<'primary'>;
  };
}

export interface ContactPhone extends Schema.Component {
  collectionName: 'components_contact_phones';
  info: {
    displayName: 'Phone';
    icon: 'phone';
  };
  attributes: {
    type: Attribute.String;
    number: Attribute.BigInteger;
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
