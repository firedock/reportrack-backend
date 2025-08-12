const dayjs = require('dayjs');

module.exports = {
  async beforeCreate(event) {
    // console.log('beforeCreate work-order');
  },
  
  async beforeUpdate(event) {
    const { params } = event;
    const workOrderId = params.where.id;
    
    // Get the current work order to compare changes
    const currentWorkOrder = await strapi.db.query('api::work-order.work-order').findOne({
      where: { id: workOrderId },
      populate: {
        property: {
          populate: ['users']
        },
        customer: {
          populate: ['users']
        }
      }
    });
    
    if (currentWorkOrder) {
      // Store current state for comparison in afterUpdate
      event.state = { currentWorkOrder };
    }
  },

  async afterUpdate(event) {
    const { result, params, state } = event;
    const { currentWorkOrder } = state || {};
    
    if (!currentWorkOrder) return;
    
    // Get the updated work order with relations
    const updatedWorkOrder = await strapi.db.query('api::work-order.work-order').findOne({
      where: { id: result.id },
      populate: {
        property: {
          populate: ['users']
        },
        customer: {
          populate: ['users']
        }
      }
    });

    // Check what changed
    const changes = [];
    if (currentWorkOrder.status !== updatedWorkOrder.status) {
      changes.push(`Status changed from "${currentWorkOrder.status}" to "${updatedWorkOrder.status}"`);
    }
    if (currentWorkOrder.title !== updatedWorkOrder.title) {
      changes.push(`Title changed from "${currentWorkOrder.title}" to "${updatedWorkOrder.title}"`);
    }
    if (currentWorkOrder.dueBy !== updatedWorkOrder.dueBy) {
      const oldDue = currentWorkOrder.dueBy ? dayjs(currentWorkOrder.dueBy).format('MM/DD/YYYY h:mmA') : 'Not set';
      const newDue = updatedWorkOrder.dueBy ? dayjs(updatedWorkOrder.dueBy).format('MM/DD/YYYY h:mmA') : 'Not set';
      changes.push(`Due date changed from "${oldDue}" to "${newDue}"`);
    }

    if (changes.length > 0) {
      // Send notifications
      await strapi.service('api::work-order.work-order').sendChangeNotification(updatedWorkOrder, changes);
    }
  },
};
