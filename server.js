const express = require("express");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const metadataPath = path.join(__dirname, "files.json");
let fileMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function uploadToCloudinary(filePath) {
    return cloudinary.uploader.upload(filePath, {
        resource_type: "raw",
        folder: "mini-file-upload-app"
    });
}

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});


const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024
    },

    fileFilter: function(req, file, cb) {
        const allowedTypes = [
                    
            
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",

            
            "application/pdf",
            "text/plain",

            
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

            
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

            
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only images, PDFs, and text files are allowed."));
        }
    }
});


const app = express();

app.use(express.static("public"));



app.post("/upload", function(req, res) {
    upload.array("files", 10)(req, res, async function(err) {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    message: "A file exceeds the 25 MB limit."
                });
            }

            if (err.code === "LIMIT_FILE_COUNT") {
                return res.status(400).json({
                    message: "You can upload a maximum of 10 files at once."
                });
            }

            return res.status(400).json({
                message: "Upload failed: " + err.message
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: "Please select at least one file."
            });
        }

        try {
            const uploadedFiles = await Promise.all(
                req.files.map(async function(file) {
                    const result = await uploadToCloudinary(file.path);

                    return {
                        filename: file.filename,
                        publicUrl: result.secure_url,
                        publicId: result.public_id
                    };
                })
            );

            uploadedFiles.forEach(function(file) {
                fileMetadata[file.filename] = {
                    publicUrl: file.publicUrl,
                    publicId: file.publicId
                };
            });

            fs.writeFileSync(
                metadataPath,
                JSON.stringify(fileMetadata, null, 2)
            );

            res.json({
                message: uploadedFiles.length +
                    " file(s) uploaded successfully!",
                files: uploadedFiles
            });
        } catch (error) {
            console.error("Cloudinary upload failed:", error.message);

            res.status(500).json({
                message: "Files were saved locally, but uploading to Cloudinary failed."
            });
        }
    });
});


app.get("/files", function(req, res) {
    fs.readdir("uploads/", { withFileTypes: true }, function(err, entries) {
        if (err) {
            return res.status(500).json({
                message: "Unable to read uploaded files."
            });
        }

        const files = entries
            .filter(function(entry) {
                return entry.isFile();
            })
            .map(function(entry) {
                const filePath = path.join(__dirname, "uploads", entry.name);
                const stats = fs.statSync(filePath);

                return {
                    name: entry.name,
                    size: stats.size,
                    type: path.extname(entry.name).slice(1).toUpperCase() || "Unknown",
                    publicUrl: fileMetadata[entry.name]?.publicUrl ||
                    (typeof fileMetadata[entry.name] === "string"
                        ? fileMetadata[entry.name]
                        : null)
                };
            });

        res.json(files);
    });
});



app.get("/files/:filename", function(req, res) {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, "uploads", filename);

    res.sendFile(filePath, function(err) {
        if (err) {
            if (!res.headersSent) {
                res.status(err.statusCode || 500).json({
                    message: "Unable to open file."
                });
            }
        }
    });
});



app.delete("/files/:filename", async function(req, res) {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, "uploads", filename);
    const metadata = fileMetadata[filename];

    
    let publicId = null;

    if (metadata && typeof metadata === "object") {
        publicId = metadata.publicId || null;
    } else if (typeof metadata === "string") {
        try {
            const url = new URL(metadata);

            if (
                url.hostname === "res.cloudinary.com" &&
                url.pathname.startsWith("/fg9q738m/raw/upload/")
            ) {
                const parts = url.pathname.split("/");
                const uploadIndex = parts.indexOf("upload");

                if (uploadIndex !== -1) {
                    let assetParts = parts.slice(uploadIndex + 1);

                    // Skip the version segment, such as v1791568781.
                    if (/^v\d+$/.test(assetParts[0])) {
                        assetParts.shift();
                    }

                    publicId = assetParts.join("/");
                }
            }
        } catch {
            // Leave publicId null if the legacy URL is invalid.
        }
    }


        if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            message: "File not found."
        });
    }

    try {

    if (publicId) {
        const cloudResult = await cloudinary.uploader.destroy(
            publicId,
            { resource_type: "raw" }
        );

        if (cloudResult.result !== "ok" &&
            cloudResult.result !== "not found") {
            throw new Error(
                "Cloudinary deletion failed: " + cloudResult.result
            );
        }
    }

        // Delete the local copy.
        await fs.promises.unlink(filePath);

        // Prepare updated metadata without changing the current object yet.
        const updatedMetadata = { ...fileMetadata };
        delete updatedMetadata[filename];

        await fs.promises.writeFile(
            metadataPath,
            JSON.stringify(updatedMetadata, null, 2)
        );

        // Update in-memory metadata only after the file is saved.
        fileMetadata = updatedMetadata;

        res.json({
            message: "File deleted successfully!"
        });
    } catch (error) {
        console.error("File deletion failed:", error.message);

        if (error.code === "ENOENT") {
            return res.status(404).json({
                message: "File not found."
            });
        }

        res.status(500).json({
            message: "Unable to delete file completely. Please check the server logs."
        });
    }
});


cloudinary.api.ping()
    .then(function(result) {
        console.log("Cloudinary connection successful:", result.status);
    })
    .catch(function(error) {
        console.log("Cloudinary connection failed:", error.message);
    });

app.listen(3000, function() {
    console.log("Server is running on port 3000");
});