// @ts-nocheck
const { ApplicationError, ValidationError } = require('@strapi/utils').errors;
const bcrypt = require('bcryptjs'); // Import bcrypt for password hashing
const { sanitize } = require('@strapi/utils');

module.exports = (plugin) => {
  // create
  (plugin.controllers.user.create = async (ctx) => {
    try {
      // Validate incoming user data
      const { email, username, role, password } = ctx.request.body;

      if (!password) {
        throw new ValidationError('Password is required');
      }

      // Check for duplicate username
      const userWithSameUsername = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { username } });

      if (userWithSameUsername) {
        throw new ApplicationError('Username already taken');
      }

      // Check for duplicate email
      const advanced = await strapi
        .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
        .get();

      if (advanced.unique_email) {
        const userWithSameEmail = await strapi
          .query('plugin::users-permissions.user')
          .findOne({ where: { email: email.toLowerCase() } });

        if (userWithSameEmail) {
          throw new ApplicationError('Email already taken');
        }
      }

      // Hash the password before storing it
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user object
      const newUser = {
        ...ctx.request.body,
        email: email.toLowerCase(),
        password: hashedPassword, // Store hashed password
        provider: 'local',
      };

      // Assign default role if none provided
      if (!role) {
        const defaultRole = await strapi
          .query('plugin::users-permissions.role')
          .findOne({ where: { type: advanced.default_role } });

        if (!defaultRole) {
          throw new ValidationError('Default role not found.');
        }
        newUser.role = defaultRole.id;
      }

      // Save the new user
      const createdUser = await strapi
        .query('plugin::users-permissions.user')
        .create({ data: newUser });

      // Sanitize the user data
      const sanitizedUser = await sanitize.contentAPI.output(
        createdUser,
        strapi.getModel('plugin::users-permissions.user')
      );

      // Return the created user
      ctx.status = 201;
      ctx.body = { data: sanitizedUser };
    } catch (error) {
      // Log error for debugging
      console.error('Error creating user:', error);

      // Handle and return a proper error response
      const errorMessage =
        error instanceof ApplicationError || error instanceof ValidationError
          ? error.message
          : 'An unexpected error occurred';
      ctx.status = error.status || 400;
      ctx.body = { error: { status: ctx.status, message: errorMessage } };
    }
  }),
    // update
    (plugin.controllers.user.update = async (ctx) => {
      try {
        const { id } = ctx.params; // User ID from the request params
        const { email, username, role, password } = ctx.request.body;

        // Fetch the existing user
        const existingUser = await strapi
          .query('plugin::users-permissions.user')
          .findOne({ where: { id } });

        if (!existingUser) {
          throw new NotFoundError('User not found');
        }

        // Check for duplicate username (excluding the current user)
        if (username && username !== existingUser.username) {
          const userWithSameUsername = await strapi
            .query('plugin::users-permissions.user')
            .findOne({ where: { username } });

          if (
            userWithSameUsername &&
            userWithSameUsername.id !== existingUser.id
          ) {
            throw new ApplicationError('Username already taken');
          }
        }

        // Check for duplicate email (excluding the current user)
        const advanced = await strapi
          .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
          .get();

        if (email && email !== existingUser.email && advanced.unique_email) {
          const userWithSameEmail = await strapi
            .query('plugin::users-permissions.user')
            .findOne({ where: { email: email.toLowerCase() } });

          if (userWithSameEmail && userWithSameEmail.id !== existingUser.id) {
            throw new ApplicationError('Email already taken');
          }
        }

        // Prepare the update data
        const updateData = {
          ...ctx.request.body,
          email: email?.toLowerCase() || existingUser.email,
          role: role || existingUser.role,
        };

        // Hash the password if provided
        if (password) {
          if (password === '') {
            throw new ValidationError('Password cannot be empty');
          }
          const hashedPassword = await bcrypt.hash(password, 10);
          updateData.password = hashedPassword; // Replace plaintext password with hashed password
        }

        // Perform the update
        const updatedUser = await strapi
          .query('plugin::users-permissions.user')
          .update({ where: { id }, data: updateData });

        // Sanitize the updated user data
        const sanitizedUser = await sanitize.contentAPI.output(
          updatedUser,
          strapi.getModel('plugin::users-permissions.user')
        );

        // Return the updated user
        ctx.status = 200;
        ctx.body = { data: sanitizedUser };
      } catch (error) {
        // Log error for debugging
        console.error('Error updating user:', error);

        // Handle and return a proper error response
        const errorMessage =
          error instanceof ApplicationError ||
          error instanceof ValidationError ||
          error instanceof NotFoundError
            ? error.message
            : 'An unexpected error occurred';
        ctx.status = error.status || 400;
        ctx.body = { error: { status: ctx.status, message: errorMessage } };
      }
    }), // Find users with customers inferred from their properties
    (plugin.controllers.user.find = async (ctx) => {
      try {
        const { page = 1, pageSize = 25 } = ctx.query.pagination || {};
        const { sort, filters } = ctx.query || {};

        // Construct the query options
        const queryOptions = {
          limit: parseInt(pageSize, 10),
          offset: (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
          orderBy: sort ? { [sort.split(':')[0]]: sort.split(':')[1] } : {},
          where: filters || {},
          populate: {
            role: true,
            properties: {
              populate: {
                customer: true, // Populate customer from properties
              },
            },
          },
        };

        // Fetch users with properties and their related customers
        const users = await strapi
          .query('plugin::users-permissions.user')
          .findMany(queryOptions);

        // Fetch total count of users
        const totalUsers = await strapi
          .query('plugin::users-permissions.user')
          .count(queryOptions.where);

        // Calculate pagination details
        const pageCount = Math.ceil(totalUsers / parseInt(pageSize, 10));

        // Process users to infer customers from properties safely
        const sanitizedUsers = await Promise.all(
          users.map(async (user) => {
            const sanitizedUser = await sanitize.contentAPI.output(
              user,
              strapi.getModel('plugin::users-permissions.user')
            );

            // Safely extract unique customers from properties
            const uniqueCustomers = sanitizedUser.properties
              .filter((prop) => prop.customer) // Ensure customer exists
              .map((prop) => prop.customer)
              .filter(
                (customer, index, self) =>
                  customer &&
                  self.findIndex((c) => c.id === customer.id) === index
              );

            return {
              id: sanitizedUser.id,
              attributes: {
                username: sanitizedUser.username,
                email: sanitizedUser.email,
                provider: sanitizedUser.provider,
                confirmed: sanitizedUser.confirmed,
                blocked: sanitizedUser.blocked,
                receiveAlarmNotifications:
                  sanitizedUser.receiveAlarmNotifications,
                createdAt: sanitizedUser.createdAt,
                updatedAt: sanitizedUser.updatedAt,
                name: sanitizedUser.name,
                role: sanitizedUser.role,
                customers: uniqueCustomers, // Customers inferred from properties
                properties: sanitizedUser.properties,
              },
            };
          })
        );

        // Prepare and send the response
        const response = {
          data: sanitizedUsers,
          meta: {
            pagination: {
              page: parseInt(page, 10),
              pageSize: parseInt(pageSize, 10),
              pageCount,
              total: totalUsers,
            },
          },
        };

        ctx.send(response);
      } catch (error) {
        // Log the error for debugging purposes
        console.error('Error in user.find controller:', error);

        // Send an appropriate error response
        ctx.status = error.status || 500;
        ctx.body = {
          error: {
            status: ctx.status,
            name: error.name || 'InternalServerError',
            message: error.message || 'An unexpected error occurred.',
          },
        };
      }
    });

  return plugin;
};
