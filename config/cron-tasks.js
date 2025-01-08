const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = {
  // Cron job to trigger alarms every minute
  oneMinuteJob: {
    task: async ({ strapi }) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp}: Cron job executed every minute`);
      const alarmTriggerUrl = `${process.env.PUBLIC_URL}/api/alarms/trigger`;

      // MongoDB connection settings
      const mongoUri = process.env.MONGO_URI; // MongoDB URI stored in environment variable
      const dbName = 'reportrack'; // Replace with your MongoDB database name
      const collectionName = 'alarmResponses'; // Replace with your MongoDB collection name

      let mongoClient;

      try {
        // Connect to MongoDB
        mongoClient = new MongoClient(mongoUri, {
          // @ts-ignore
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const collection = db.collection(collectionName);

        // Call the API
        const response = await axios.post(
          alarmTriggerUrl,
          {}, // No payload
          {
            headers: {
              Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`,
            },
          }
        );

        // console.log('API response:', response.data);

        // Store the API response in MongoDB
        const result = await collection.insertOne({
          timestamp,
          response: response.data, // Store the API response
        });
        console.log('Response stored in MongoDB:', result.insertedId);
      } catch (error) {
        console.error('Error triggering alarm API:', error.message);
        console.error('Full error details:', error.response?.data || error);

        // Optionally store the error in MongoDB for logging purposes
        if (mongoClient) {
          const db = mongoClient.db(dbName);
          const collection = db.collection(collectionName);
          await collection.insertOne({
            timestamp,
            error: error.message,
            details: error.response?.data || error, // Store the error details
          });
          console.log('Error details stored in MongoDB');
        }
      } finally {
        // Close the MongoDB connection
        if (mongoClient) {
          await mongoClient.close();
        }
      }
    },
    options: {
      rule: '* * * * *', // Every minute
      tz: 'America/Los_Angeles', // Set timezone if needed
    },
  },
};
