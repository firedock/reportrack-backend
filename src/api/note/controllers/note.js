'use strict';

/**
 * note controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::note.note', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to create notes');
    }

    const { data } = ctx.request.body;

    if (!data || !data.note || !data.note.trim()) {
      return ctx.badRequest('Note content is required');
    }

    const userRole = user?.role?.name;

    // Verify user has access to the service_record if provided
    if (data.service_record) {
      const serviceRecord = await strapi.db.query('api::service-record.service-record').findOne({
        where: { id: data.service_record },
        populate: {
          property: { populate: ['users'] },
          users_permissions_user: true,
        }
      });

      if (!serviceRecord) {
        return ctx.notFound('Service record not found');
      }

      let hasAccess = false;

      if (userRole === 'Subscriber' || userRole === 'Admin') {
        hasAccess = true;
      } else if (userRole === 'Customer') {
        // Customer must be associated with the property
        const propertyUsers = serviceRecord.property?.users || [];
        hasAccess = propertyUsers.some(u => u.id === user.id);
      } else if (userRole === 'Service Person') {
        // Service Person must be the one who created the service record
        hasAccess = serviceRecord.users_permissions_user?.id === user.id;
      }

      if (!hasAccess) {
        return ctx.forbidden('You do not have permission to add notes to this service record');
      }
    }

    // Set createdByUser to current user
    ctx.request.body.data.createdByUser = user.id;

    console.log('Note create - authorized:', {
      userId: user.id,
      userRole,
      serviceRecordId: data.service_record
    });

    // Call the default create
    return await super.create(ctx);
  },

  async find(ctx) {
    const user = ctx.state.user; // Get the authenticated user
    // Use the service to fetch the records based on user filters
    const records = await strapi
      .service('api::note.note')
      .findRecordsByUser(user, ctx.query);

    return ctx.send(records); // Return the filtered records
  },

  async update(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    // First, get the existing note to check ownership
    const existingNote = await strapi.db.query('api::note.note').findOne({
      where: { id },
      populate: ['createdByUser']
    });

    if (!existingNote) {
      return ctx.notFound('Note not found');
    }

    // Debug logging
    console.log('Update note check:', {
      noteId: id,
      currentUserId: user.id,
      currentUserRole: user?.role?.name,
      noteCreatedByUser: existingNote.createdByUser,
      noteCreatedByUserId: existingNote.createdByUser?.id
    });

    // Check if user owns this note or is admin
    const userRole = user?.role?.name;
    const isOwner = existingNote.createdByUser?.id === user.id;
    const canEdit = isOwner || userRole === 'Admin';

    if (!canEdit) {
      return ctx.forbidden('You can only edit your own notes');
    }

    // Use default update behavior
    return await super.update(ctx);
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    // First, get the existing note to check ownership
    const existingNote = await strapi.db.query('api::note.note').findOne({
      where: { id },
      populate: ['createdByUser']
    });

    if (!existingNote) {
      return ctx.notFound('Note not found');
    }

    // Check if user owns this note or is admin
    const userRole = user?.role?.name;
    const isOwner = existingNote.createdByUser?.id === user.id;
    const canDelete = isOwner || userRole === 'Admin';

    if (!canDelete) {
      return ctx.forbidden('You can only delete your own notes');
    }

    // Use default delete behavior
    return await super.delete(ctx);
  },
}));
