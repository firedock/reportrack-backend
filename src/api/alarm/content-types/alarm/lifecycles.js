module.exports = {
  async beforeCreate(event) {
    const { params } = event;

    // Check if params.data exists
    if (params.data) {
      // Access the current user via ctx.state.user
      const ctx = strapi.requestContext.get();
      if (ctx?.state?.user?.role?.name) {
        params.data.createdByRole = ctx.state.user.role.name; // Set createdByRole dynamically
      } else {
        console.error('User role not found in context. Setting default role.');
        params.data.createdByRole = 'Unknown'; // Fallback role
      }

      console.log('Updated params.data with createdByRole:', params.data);
    } else {
      console.error('params.data is missing in beforeCreate hook');
    }
  },
};
