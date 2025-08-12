module.exports = {
  async beforeCreate(event) {
    const { params } = event;
    
    // Try to get the user from the request context
    const ctx = strapi.requestContext.get();
    console.log('Creating note - user context:', {
      hasContext: !!ctx,
      hasUser: !!ctx?.state?.user,
      userId: ctx?.state?.user?.id,
      userRole: ctx?.state?.user?.role?.name
    });
    
    if (ctx?.state?.user?.id) {
      // Set the createdByUser relation to the current user
      params.data.createdByUser = ctx.state.user.id;
      console.log('Set createdByUser to:', ctx.state.user.id);
    }
  },

  async afterCreate(event) {
    const { result } = event;
    
    console.log('Note afterCreate - initial result:', { id: result.id });
    
    try {
      // Fetch the full note with work_order and property populated since they're not in the initial result
      const fullNote = await strapi.db.query('api::note.note').findOne({
        where: { id: result.id },
        populate: ['work_order', 'property']
      });
      
      console.log('Note afterCreate - full note data:', {
        id: fullNote.id,
        hasWorkOrder: !!fullNote.work_order,
        workOrderId: fullNote.work_order?.id || fullNote.work_order,
        hasProperty: !!fullNote.property,
        propertyId: fullNote.property?.id || fullNote.property
      });
      
      // Send notifications for both work order notes and property notes
      if (fullNote.work_order) {
        console.log('Note has work order, calling sendNoteNotification...');
        await strapi.service('api::note.note').sendNoteNotification(fullNote);
      } else if (fullNote.property) {
        console.log('Note has property, calling sendPropertyNoteNotification...');
        await strapi.service('api::note.note').sendPropertyNoteNotification(fullNote);
      } else {
        console.log('Note not associated with work order or property, skipping notification');
      }
    } catch (error) {
      console.error('Error in note afterCreate lifecycle:', error);
    }
  }
};