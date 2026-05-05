const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { timezoneFromState } = require('../../../../utils/timezoneFromState');

dayjs.extend(utc);
dayjs.extend(timezone);

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    const ctx = strapi.requestContext.get();
    const user = ctx?.state?.user;

    console.log('Work Order beforeCreate - user context:', {
      hasCtx: !!ctx,
      hasUser: !!user,
      userId: user?.id,
      userName: user?.username,
      userEmail: user?.email,
    });

    // Set the author field to the current user (references up_users, not admin_users)
    if (user && user.id && !data.author) {
      data.author = user.id;
      console.log(`Setting work order author to user ${user.id} (${user.username})`);
    }

    // If created by a customer and no status provided, set to "New"
    if (user?.role?.name === 'Customer' && !data.status) {
      data.status = 'New';
    }

    // If no status provided at all, default to "New"
    if (!data.status) {
      data.status = 'New';
    }
  },
  
  async afterCreate(event) {
    const { result } = event;
    const ctx = strapi.requestContext.get();
    const user = ctx?.state?.user;
    
    // Get the created work order with relations
    const createdWorkOrder = await strapi.db.query('api::work-order.work-order').findOne({
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
    
    if (createdWorkOrder) {
      // Send creation notification
      await strapi.service('api::work-order.work-order').sendCreationNotification(createdWorkOrder, user);

      // Record a client-change row when a Customer creates a work order.
      if (user?.role?.name === 'Customer') {
        await strapi.service('api::client-change.client-change').record({
          changeType: 'Work Order Created',
          entityType: 'work-order',
          entityId: createdWorkOrder.id,
          changeDetails: { title: createdWorkOrder.title, status: createdWorkOrder.status },
          property: createdWorkOrder.property?.id,
          customer: createdWorkOrder.customer?.id,
          account: createdWorkOrder.account?.id,
          changedByUser: user.id,
        });
      }
    }
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
      const tz = timezoneFromState(updatedWorkOrder.property?.state);
      const oldDue = currentWorkOrder.dueBy ? dayjs.utc(currentWorkOrder.dueBy).tz(tz).format('MM/DD/YYYY h:mmA') : 'Not set';
      const newDue = updatedWorkOrder.dueBy ? dayjs.utc(updatedWorkOrder.dueBy).tz(tz).format('MM/DD/YYYY h:mmA') : 'Not set';
      changes.push(`Due date changed from "${oldDue}" to "${newDue}"`);
    }

    if (changes.length > 0) {
      // Send notifications
      await strapi.service('api::work-order.work-order').sendChangeNotification(updatedWorkOrder, changes);

      // Record a client-change row when the editor is a Customer so Subscribers
      // can review what their clients have changed.
      const ctx = strapi.requestContext.get();
      const editor = ctx?.state?.user;
      if (editor?.role?.name === 'Customer') {
        await strapi.service('api::client-change.client-change').record({
          changeType:
            currentWorkOrder.status !== updatedWorkOrder.status
              ? 'Work Order Status Changed'
              : 'Work Order Updated',
          entityType: 'work-order',
          entityId: updatedWorkOrder.id,
          changeDetails: { changes },
          property: updatedWorkOrder.property?.id,
          customer: updatedWorkOrder.customer?.id,
          account: updatedWorkOrder.account?.id,
          changedByUser: editor.id,
        });
      }
    }
  },
};
