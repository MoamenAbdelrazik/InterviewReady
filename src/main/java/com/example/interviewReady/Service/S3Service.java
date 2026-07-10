package com.example.interviewReady.Service;

import java.time.Duration;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class S3Service {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public S3Service(S3Client s3Client, S3Presigner s3Presigner) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    /**
     * Generate a pre-signed PUT URL for the frontend to upload directly to S3.
     * @param folder  e.g. "profile-images"
     * @param originalFilename  e.g. "photo.jpg"
     * @return pre-signed URL valid for 5 minutes
     */
    public String generateUploadUrl(String folder, String originalFilename) {
        String key = folder + "/" + UUID.randomUUID() + "_" + originalFilename;

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(5))
                .putObjectRequest(PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .build())
                .build();

        return s3Presigner.presignPutObject(presignRequest).url().toString();
    }

    /**
     * Generate a pre-signed GET URL to view/download a file from S3.
     * @param key  the S3 object key (stored in DB)
     * @return pre-signed URL valid for 1 hour
     */
    public String generateDownloadUrl(String key) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofHours(1))
                .getObjectRequest(req -> req.bucket(bucketName).key(key))
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    /**
     * Extract the S3 key from a full S3 URL or pre-signed URL.
     * The frontend sends back the URL after upload — we extract and store just the key.
     */
    public String extractKeyFromUrl(String url) {
        // URL format: https://bucket.s3.region.amazonaws.com/folder/uuid_filename
        String prefix = bucketName + ".s3.";
        int keyStart = url.indexOf(prefix);
        if (keyStart == -1) {
            // Fallback: path-style URL
            return url.substring(url.indexOf(bucketName) + bucketName.length() + 1).split("\\?")[0];
        }
        String afterHost = url.substring(url.indexOf("/", url.indexOf(prefix)) + 1);
        return afterHost.split("\\?")[0]; // Remove query params (pre-signed params)
    }

    /**
     * Delete an object from S3.
     */
    public void deleteObject(String key) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build());
    }
}
