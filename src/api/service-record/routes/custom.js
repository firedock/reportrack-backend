module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/service-records/custom/count',
      handler: 'service-record.count',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    {
      method: 'POST',
      path: '/service-records/custom/count-post',
      handler: 'service-record.countPost',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    // More specific route must come BEFORE the general :id route
    {
      method: 'POST',
      path: '/service-records/:id/incidents',
      handler: 'service-record.reportIncident',
      config: {
        // policies: ['global::isOwner'],
      },
    },
    // Update subscriber notes on an incident (Subscriber/Admin only)
    {
      method: 'PUT',
      path: '/service-records/:id/incidents/:incidentId/notes',
      handler: 'service-record.updateIncidentNotes',
      config: {},
    },
    // Send incident to client - manual trigger (Subscriber/Admin only)
    {
      method: 'POST',
      path: '/service-records/:id/incidents/:incidentId/send-to-client',
      handler: 'service-record.sendIncidentToClient',
      config: {},
    },
    {
      method: 'GET',
      path: '/service-records/:id',
      handler: 'service-record.findOne',
      config: {
        // policies: ['global::isOwner'],
      },
    },
  ],
};
