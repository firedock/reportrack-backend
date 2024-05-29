module.exports = {
  async beforeCreate(event) {
    const { params } = event;
    const { data, context } = params;

    if (context && context.state && context.state.user) {
      data.createdBy = context.state.user.id;
    }
  },
  async beforeUpdate(event) {
    const { params } = event;
    const { data, context } = params;

    if (context && context.state && context.state.user) {
      data.updatedBy = context.state.user.id;
    }
  },
};
