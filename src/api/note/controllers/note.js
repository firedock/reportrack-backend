'use strict';

/**
 * note controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::note.note', ({ strapi }) => ({
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
