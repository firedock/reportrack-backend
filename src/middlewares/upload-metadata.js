'use strict';

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Only process upload requests
    if (ctx.request.url === '/api/upload' && ctx.request.method === 'POST') {
      // Store the original response handler
      const originalEnd = ctx.res.end;
      
      // Override the response end to intercept the result
      ctx.res.end = function (chunk, encoding) {
        // Restore original end method
        ctx.res.end = originalEnd;
        
        // Process the upload metadata if fileInfo exists
        if (ctx.request.body && ctx.request.body.fileInfo) {
          try {
            const fileInfo = JSON.parse(ctx.request.body.fileInfo);
            
            // Parse the response to get uploaded file IDs
            if (chunk) {
              const uploadResult = JSON.parse(chunk.toString());
              
              if (Array.isArray(uploadResult)) {
                // Update each uploaded file with metadata
                uploadResult.forEach(async (file) => {
                  const updateData = {};
                  
                  // Add caption and alt text for display
                  if (fileInfo.uploadTime) {
                    updateData.caption = `Uploaded: ${new Date(fileInfo.uploadTime).toLocaleString()}`;
                  }
                  
                  if (fileInfo.location && fileInfo.location.latitude && fileInfo.location.longitude) {
                    updateData.alternativeText = `GPS: ${fileInfo.location.latitude}, ${fileInfo.location.longitude}`;
                  }

                  // Store in provider_metadata
                  updateData.provider_metadata = {
                    ...file.provider_metadata,
                    uploadTime: fileInfo.uploadTime,
                    gpsCoordinates: fileInfo.location,
                  };

                  // Update the file
                  try {
                    await strapi.plugins.upload.services.upload.update(file.id, updateData);
                  } catch (error) {
                    console.error('Error updating file metadata:', error);
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error processing upload metadata:', error);
          }
        }
        
        // Call the original end method
        originalEnd.call(this, chunk, encoding);
      };
    }
    
    await next();
  };
};