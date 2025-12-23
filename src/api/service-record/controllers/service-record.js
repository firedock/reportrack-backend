'use strict';

/**
 * service-record controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::service-record.service-record',
  ({ strapi }) => ({
    async count(ctx) {
      try {
        // Extract filters from the context if provided
        const { filters } = ctx.query || {};

        // Fetch total count with optional filters
        const total = await strapi
          .query('api::service-record.service-record')
          .count({ where: filters });

        // Prepare the response
        const response = { count: total };

        // Send the response
        ctx.send(response);
      } catch (error) {
        // Send the error response
        ctx.send({ error: error.message });
      }
    },

    async countPost(ctx) {
      try {
        // Extract filters from the request body
        const { filters } = ctx.request.body || {};

        // Fetch total count with optional filters
        const total = await strapi
          .query('api::service-record.service-record')
          .count({ where: filters });

        // Prepare the response
        const response = { count: total };

        // Send the response
        ctx.send(response);
      } catch (error) {
        // Send the error response
        ctx.send({ error: error.message });
      }
    },
    async find(ctx) {
      const user = ctx.state.user; // Get the authenticated user
      // console.log('user', user);
      // Use the service to fetch the records based on user filters
      const records = await strapi
        .service('api::service-record.service-record')
        .findRecordsByUser(user, ctx.query);

      return ctx.send(records); // Return the filtered records
    },
    async create(ctx) {
      const { id } = ctx.state.user; // Get the current user ID
      const response = await super.create(ctx); // Create the record
      const updatedResponse = await strapi.entityService.update(
        'api::service-record.service-record',
        response.data.id,
        { data: { author: id } } // Set the author field
      );
      return updatedResponse;
    },

    async update(ctx) {
      const { id } = ctx.state.user; // Get the current user ID
      const response = await super.update(ctx); // Update the record
      const updatedResponse = await strapi.entityService.update(
        'api::service-record.service-record',
        response.data.id,
        { data: { editor: id } } // Set the editor field to current user
      );
      return updatedResponse;
    },

    // Override findOne to always populate media
    async findOne(ctx) {
      const { id } = ctx.params;

      const entity = await strapi.entityService.findOne(
        'api::service-record.service-record',
        id,
        {
          populate: {
            users_permissions_user: true,
            account: true,
            property: true,
            customer: true,
            service_type: true,
            author: true,
            editor: true,
            media: true, // Explicitly populate media
          },
        }
      );

      const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
      return this.transformResponse(sanitizedEntity);
    },

    async reportIncident(ctx) {
      try {
        const { id } = ctx.params;
        const { description, severity, location, mediaIds } = ctx.request.body;
        const user = ctx.state.user;

        console.log('📝 reportIncident called for service record:', id);
        console.log('📝 Request body:', JSON.stringify(ctx.request.body));
        console.log('📝 User:', user?.id, user?.username);

        // Check if user is authenticated
        if (!user) {
          console.error('❌ No authenticated user');
          return ctx.unauthorized('You must be logged in to report an incident');
        }

        // Validate required fields
        if (!description) {
          console.error('❌ Missing description');
          return ctx.badRequest('Description is required');
        }

        // Validate photo requirement - at least one photo is required
        if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
          console.error('❌ No photos provided');
          return ctx.badRequest('At least one photo is required for incident reports');
        }

        // Get current service record with deep population for notifications
        console.log('📝 Fetching service record...');
        const serviceRecord = await strapi.db.query('api::service-record.service-record').findOne({
          where: { id },
          populate: {
            property: { populate: { users: true, customer: { populate: ['users'] } } },
            customer: { populate: ['users'] },
            users_permissions_user: true,
            service_type: true,
          }
        });

        if (!serviceRecord) {
          console.error('❌ Service record not found:', id);
          return ctx.notFound('Service record not found');
        }

        console.log('✅ Service record found:', serviceRecord.id);

        // Create incident object
        const incident = {
          id: require('crypto').randomUUID(),
          description,
          severity: severity || 'medium',
          reportedAt: new Date().toISOString(),
          reportedBy: { id: user.id, username: user.username, email: user.email },
          location: location || null,
          mediaIds: mediaIds || [],
          notificationSent: false
        };

        console.log('📝 Created incident:', incident.id);

        // Update service record with incident
        const existingIncidents = serviceRecord.incidents || [];
        console.log('📝 Existing incidents count:', existingIncidents.length);

        const updatedRecord = await strapi.entityService.update('api::service-record.service-record', id, {
          data: {
            incidents: [...existingIncidents, incident],
            hasReportedIssues: true
          }
        });

        console.log('✅ Service record updated with incident');

        // Send notification (don't let notification failure block response)
        try {
          await strapi.service('api::service-record.service-record').sendIncidentNotification(serviceRecord, incident);
        } catch (err) {
          console.error('⚠️ Error sending incident notification:', err);
        }

        return { data: updatedRecord, incident };
      } catch (error) {
        console.error('❌ reportIncident error:', error);
        return ctx.internalServerError(`Failed to report incident: ${error.message}`);
      }
    },
  })
);
