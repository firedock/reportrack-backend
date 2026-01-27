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
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized('You must be logged in to create a service record');
        }

        const { id } = user; // Get the current user ID

        console.log('📝 Creating service record for user:', id, user.username);
        console.log('📝 Request body:', JSON.stringify(ctx.request.body));

        const response = await super.create(ctx); // Create the record

        if (!response?.data?.id) {
          console.error('❌ Service record creation returned no ID');
          return ctx.internalServerError('Failed to create service record - no ID returned');
        }

        console.log('✅ Service record created:', response.data.id);

        const updatedResponse = await strapi.entityService.update(
          'api::service-record.service-record',
          response.data.id,
          { data: { author: id } } // Set the author field
        );

        return updatedResponse;
      } catch (error) {
        console.error('❌ Service record create error:', error);
        console.error('❌ Error stack:', error.stack);

        // Check if it's a validation error (like active service record exists)
        if (error.name === 'ValidationError' || error.details?.code === 'ACTIVE_SERVICE_RECORD_EXISTS') {
          return ctx.badRequest(error.message, error.details);
        }

        // Return a more descriptive error
        return ctx.internalServerError(`Failed to create service record: ${error.message}`);
      }
    },

    async update(ctx) {
      try {
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized('You must be logged in to update a service record');
        }

        const { id } = user; // Get the current user ID
        const recordId = ctx.params.id;

        console.log('📝 Updating service record:', recordId, 'by user:', id);

        const response = await super.update(ctx); // Update the record

        if (!response?.data?.id) {
          console.error('❌ Service record update returned no data');
          return ctx.internalServerError('Failed to update service record');
        }

        const updatedResponse = await strapi.entityService.update(
          'api::service-record.service-record',
          response.data.id,
          { data: { editor: id } } // Set the editor field to current user
        );

        return updatedResponse;
      } catch (error) {
        console.error('❌ Service record update error:', error);
        console.error('❌ Error stack:', error.stack);
        return ctx.internalServerError(`Failed to update service record: ${error.message}`);
      }
    },

    // Override findOne to always populate media and filter incidents for Customers
    async findOne(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;

      // Ensure we have the user's role - fetch it if not populated
      let userRole = user?.role?.name;
      if (user?.id && !userRole) {
        try {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role']
          });
          userRole = fullUser?.role?.name;
        } catch (err) {
          console.error('Error fetching user role in findOne:', err);
        }
      }

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

      // Filter incidents for Customer users - only show approved/sent incidents
      if (entity && userRole === 'Customer' && entity.incidents) {
        entity.incidents = entity.incidents.filter(incident => incident.sentToClient === true);
      }

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
          reportedBy: { id: user.id, username: user.username, email: user.email, name: user.name },
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

    /**
     * Update subscriber notes on a specific incident
     * Only Subscribers and Admins can add notes
     */
    async updateIncidentNotes(ctx) {
      try {
        const { id, incidentId } = ctx.params;
        const { subscriberNotes } = ctx.request.body;
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized('You must be logged in');
        }

        // Check if user has Subscriber or Admin role
        const userRole = user.role?.name;
        if (!['Subscriber', 'Admin'].includes(userRole)) {
          return ctx.forbidden('Only Subscribers can add notes to incidents');
        }

        const result = await strapi.service('api::service-record.service-record')
          .updateIncidentNotes(id, incidentId, subscriberNotes, user);

        if (!result.success) {
          return ctx.badRequest(result.error);
        }

        return { data: result };
      } catch (error) {
        console.error('updateIncidentNotes error:', error);
        return ctx.internalServerError(`Failed to update notes: ${error.message}`);
      }
    },

    /**
     * Send incident report to Client (Customer) users
     * Only Subscribers and Admins can trigger this action
     */
    async sendIncidentToClient(ctx) {
      try {
        const { id, incidentId } = ctx.params;
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized('You must be logged in');
        }

        // Check if user has Subscriber or Admin role
        const userRole = user.role?.name;
        if (!['Subscriber', 'Admin'].includes(userRole)) {
          return ctx.forbidden('Only Subscribers can send incidents to clients');
        }

        const result = await strapi.service('api::service-record.service-record')
          .sendIncidentToClient(id, incidentId, user);

        if (!result.success) {
          return ctx.badRequest(result.error);
        }

        return { data: result };
      } catch (error) {
        console.error('sendIncidentToClient error:', error);
        return ctx.internalServerError(`Failed to send to client: ${error.message}`);
      }
    },

    /**
     * Add a reply to an incident
     * Only Subscribers and Admins can add replies to respond to customer incidents
     */
    async addCustomerReply(ctx) {
      try {
        const { id, incidentId } = ctx.params;
        const { replyText } = ctx.request.body;
        const user = ctx.state.user;

        if (!user) {
          return ctx.unauthorized('You must be logged in');
        }

        // Get user role
        let userRole = user.role?.name;
        if (!userRole && user.id) {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role']
          });
          userRole = fullUser?.role?.name;
        }

        // Only allow Subscriber and Admin roles to add replies
        if (!['Subscriber', 'Admin'].includes(userRole)) {
          return ctx.forbidden('Only Subscribers can add replies to incidents');
        }

        // Validate reply text
        if (!replyText || typeof replyText !== 'string' || !replyText.trim()) {
          return ctx.badRequest('Reply text is required');
        }

        if (replyText.length > 2000) {
          return ctx.badRequest('Reply text cannot exceed 2000 characters');
        }

        const result = await strapi.service('api::service-record.service-record')
          .addIncidentReply(id, incidentId, replyText.trim(), user, userRole);

        if (!result.success) {
          return ctx.badRequest(result.error);
        }

        return { data: result };
      } catch (error) {
        console.error('addCustomerReply error:', error);
        return ctx.internalServerError(`Failed to submit reply: ${error.message}`);
      }
    },
  })
);
