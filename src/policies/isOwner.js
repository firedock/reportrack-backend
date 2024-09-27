// Policies are functions that execute specific logic on each request BEFORE it reaches the controller.
// They are mostly used for securing business logic.

module.exports = async (policyContext, config, { strapi }) => {
  const { id } = policyContext.params; // The ID of the resource being accessed
  const user = policyContext.state.user; // Authenticated user information

  if (!user) {
    // If the user is not authenticated, block the request
    return false;
  }

  // Get the content type from the route's info
  const modelName = policyContext.state.route.info.apiName;

  // Dynamically query the correct content type
  const record = await strapi.db
    .query(`api::${modelName}.${modelName}`)
    .findOne({
      where: { id },
    });

  if (!record) {
    // If the record is not found, block the request
    return false;
  }

  console.log('record', record);

  // Check if the user is the owner (or creator) of the resource
  if (record.createdBy && record.createdBy.id !== user.id) {
    // Block the request if the user is not the owner
    return false;
  }

  // Allow access if the user is the owner
  return true;
};
