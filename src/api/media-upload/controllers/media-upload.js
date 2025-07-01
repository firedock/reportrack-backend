'use strict';

module.exports = {
  async upload(ctx) {
    try {
      console.log('📦 Custom media upload endpoint called (auth disabled for testing)');
      
      // Parse fileInfo from request body
      let fileInfo = null;
      if (ctx.request.body && ctx.request.body.fileInfo) {
        try {
          fileInfo = JSON.parse(ctx.request.body.fileInfo);
          console.log('📍 Received metadata:', fileInfo);
        } catch (error) {
          console.error('Error parsing fileInfo:', error);
        }
      }

      // Use Strapi's upload service
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: ctx.request.files.files || ctx.request.files,
      });

      console.log('📄 Files uploaded:', uploadedFiles?.length || 0);

      // Update metadata and return updated files
      const finalFiles = [];
      
      if (fileInfo && uploadedFiles && uploadedFiles.length > 0) {
        console.log('🔄 Starting metadata update for', uploadedFiles.length, 'files');
        
        for (const file of uploadedFiles) {
          try {
            console.log(`📝 Processing file ${file.id}: ${file.name}`);
            
            const updateData = {};
            
            // Use server timestamp for consistency and security
            const serverTimestamp = new Date();
            updateData.upload_time = serverTimestamp;
            updateData.caption = `Uploaded: ${serverTimestamp.toISOString()}`;
            console.log(`⏰ Setting server timestamp: ${updateData.upload_time}`);
            
            if (fileInfo.location?.latitude && fileInfo.location?.longitude) {
              updateData.gps_latitude = parseFloat(fileInfo.location.latitude);
              updateData.gps_longitude = parseFloat(fileInfo.location.longitude);
              updateData.alternativeText = `GPS: ${fileInfo.location.latitude}, ${fileInfo.location.longitude}`;
              console.log(`📍 Setting GPS: ${updateData.gps_latitude}, ${updateData.gps_longitude}`);
            }

            updateData.provider_metadata = {
              ...file.provider_metadata,
              uploadTime: serverTimestamp.toISOString(),
              gpsCoordinates: fileInfo.location,
            };

            console.log('🔧 Update data prepared:', updateData);
            
            // Update standard fields through Strapi service
            const strapiUpdateData = {
              caption: updateData.caption,
              alternativeText: updateData.alternativeText,
              provider_metadata: updateData.provider_metadata
            };
            
            const updatedFile = await strapi.plugins.upload.services.upload.update(file.id, strapiUpdateData);
            console.log(`📝 Updated Strapi fields for file ${file.id}`);
            
            // Update custom fields directly in database
            if (updateData.upload_time || updateData.gps_latitude || updateData.gps_longitude) {
              console.log('🗄️ Updating custom fields directly in database...');
              
              const query = strapi.db.connection.raw(`
                UPDATE files 
                SET 
                  upload_time = ?,
                  gps_latitude = ?,
                  gps_longitude = ?
                WHERE id = ?
              `, [
                updateData.upload_time || null,
                updateData.gps_latitude || null, 
                updateData.gps_longitude || null,
                file.id
              ]);
              
              await query;
              console.log(`🗄️ Successfully updated database fields for file ${file.id}`);
            }
            
            // Add updated file with metadata to final results
            finalFiles.push({
              ...updatedFile,
              provider_metadata: updateData.provider_metadata
            });
            
            console.log(`✅ Successfully updated file ${file.id}: Complete`);
            
          } catch (updateError) {
            console.error(`❌ Error updating file ${file.id}:`, updateError);
            // Still add the original file if update fails
            finalFiles.push(file);
          }
        }
      } else {
        console.log('⚠️ No metadata to update:', { 
          hasFileInfo: !!fileInfo, 
          hasFiles: !!uploadedFiles, 
          fileCount: uploadedFiles?.length || 0 
        });
        // No metadata to update, return original files
        finalFiles.push(...uploadedFiles);
      }

      ctx.body = finalFiles;
    } catch (error) {
      console.error('❌ Upload error:', error);
      ctx.throw(500, 'Upload failed');
    }
  },
};