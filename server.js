const express = require("express");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const MAX_FILES = 15;
const MAX_FOLDERS = 5;
let pendingUploads = 0;

const metadataPath = path.join(__dirname, "files.json");
let fileMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

const foldersPath = path.join(__dirname, "folders.json");
let folders = JSON.parse(fs.readFileSync(foldersPath, "utf8"));
const fileLocationsPath = path.join(__dirname, "fileLocations.json");
let fileLocations = JSON.parse(fs.readFileSync(fileLocationsPath, "utf8"));

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
        fileSize: 10 * 1024 * 1024
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
app.use(express.json());

app.use(express.static("public"));



app.post("/upload", function(req, res) {
    const currentCount = Object.keys(fileMetadata).length + pendingUploads;

    if (currentCount >= MAX_FILES) {
        return res.status(409).json({
            message: "The file manager is full (" + MAX_FILES + " files max)."
        });
    }

    upload.array("files", 10)(req, res, async function(err) {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    message: "A file exceeds the 10 MB limit."
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

        const usedSlots = Object.keys(fileMetadata).length + pendingUploads;

        if (usedSlots + req.files.length > MAX_FILES) {
            // Multer already saved these files, so delete them first
            await Promise.all(
                req.files.map(function(file) {
                    return fs.promises.unlink(file.path);
                })
            );

            return res.status(409).json({
                message: "Not enough space. The file manager allows " + MAX_FILES + " files max."
            });
        }

        pendingUploads += req.files.length;

        try {
            const uploadedFiles = await Promise.all(
                req.files.map(async function(file) {
                    const result = await uploadToCloudinary(file.path);

                    return {
                        filename: file.filename,
                        displayName: file.originalname,
                        publicUrl: result.secure_url,
                        publicId: result.public_id
                    };
                })
            );

            uploadedFiles.forEach(function(file) {
                fileMetadata[file.filename] = {
                    publicUrl: file.publicUrl,
                    publicId: file.publicId,
                    displayName: file.displayName
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
        finally {
            pendingUploads -= req.files.length;
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
            return entry.isFile() && !fileLocations[entry.name];
                })
            .map(function(entry) {
                const filePath = path.join(__dirname, "uploads", entry.name);
                const stats = fs.statSync(filePath);

                return {
                    filename: entry.name,
                    name: fileMetadata[entry.name]?.displayName || entry.name,
                    size: stats.size,
                    modifiedAt: stats.mtime,
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


app.get("/folders", function(req, res) {
    res.json(folders);
});

app.get("/folders/:folderId/files", function(req, res) {
    const folderId = req.params.folderId;

    if (!folders[folderId]) {
        return res.status(404).json({
            message: "Folder not found."
        });
    }

    const folderFiles = Object.entries(fileLocations)
        .filter(function([filename, assignedFolderId]) {
            return assignedFolderId === folderId;
        })
        .map(function([filename]) {
            const filePath = path.join(__dirname, "uploads", filename);

            if (!fs.existsSync(filePath)) {
                return null;
            }

            const stats = fs.statSync(filePath);
            const metadata = fileMetadata[filename];

            return {
                filename: filename,
                name: metadata?.displayName || filename,
                size: stats.size,
                modifiedAt: stats.mtime,
                type: path.extname(filename).slice(1).toUpperCase() || "Unknown",
                publicUrl: metadata?.publicUrl ||
                    (typeof metadata === "string" ? metadata : null)
            };
        })
        .filter(function(file) {
            return file !== null;
        });

    res.json(folderFiles);
});


app.post("/folders", function(req, res) {
    const folderName = req.body.name?.trim();

    if (!folderName) {
        return res.status(400).json({
            message: "Folder name is required."
        });
    }

    const currentFolderCount = Object.keys(folders).length

    if (currentFolderCount >= MAX_FOLDERS) {
        return res.status(409).json({
            message: "Folder limit reached (" + MAX_FOLDERS + " max)."
        });
    }

    const folderId = Date.now().toString();

    folders[folderId] = {
        name: folderName
    };

    fs.writeFileSync(
        foldersPath,
        JSON.stringify(folders, null, 2)
    );

    res.status(201).json({
        id: folderId,
        name: folderName
    });
});


app.delete("/folders/:folderId", async function(req, res) {
    const folderId = req.params.folderId;

    if (!folders[folderId]) {
        return res.status(404).json({
            message: "Folder not found."
        });
    }

    const filenames = Object.entries(fileLocations)
        .filter(function([filename, assignedFolderId]) {
            return assignedFolderId === folderId;
        })
        .map(function([filename]) {
            return filename;
        });

    try {
        for (const filename of filenames) {
            const filePath = path.join(__dirname, "uploads", filename);

            const localFileExists = fs.existsSync(filePath);

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
                            const assetParts = parts.slice(uploadIndex + 1);

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

            if (publicId) {
                const cloudResult = await cloudinary.uploader.destroy(
                    publicId,
                    { resource_type: "raw" }
                );

                if (
                    cloudResult.result !== "ok" &&
                    cloudResult.result !== "not found"
                ) {
                    throw new Error(
                        "Cloudinary deletion failed for " + filename
                    );
                }
            }

            if (localFileExists) {
                await fs.promises.unlink(filePath);
            }

            delete fileMetadata[filename];
            delete fileLocations[filename];
        }

        delete folders[folderId];

        await fs.promises.writeFile(
            metadataPath,
            JSON.stringify(fileMetadata, null, 2)
        );

        await fs.promises.writeFile(
            fileLocationsPath,
            JSON.stringify(fileLocations, null, 2)
        );

        await fs.promises.writeFile(
            foldersPath,
            JSON.stringify(folders, null, 2)
        );

        res.json({
            message: "Folder and its files deleted successfully."
        });
    } catch (error) {
        console.error("Folder deletion failed:", error.message);

        res.status(500).json({
            message: "Folder deletion failed. Check the server logs."
        });
    }
});


app.post("/files/move", function(req, res) {
    const filenames = req.body.filenames;
    const folderId = req.body.folderId;

    if (!Array.isArray(filenames) || filenames.length === 0) {
        return res.status(400).json({
            message: "Please select at least one file."
        });
    }

    if (folderId !== null && (!folderId || !folders[folderId])) {
        return res.status(400).json({
            message: "Please choose a valid destination folder."
        });
    }

    filenames.forEach(function(filename) {
        if (folderId === null) {
            delete fileLocations[filename];
        } else {
            fileLocations[filename] = folderId;
        }
    });

    fs.writeFileSync(
        fileLocationsPath,
        JSON.stringify(fileLocations, null, 2)
    );

    res.json({
        message: filenames.length + " file(s) moved successfully."
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


app.patch("/files/:filename", async function(req, res) {
    const filename = path.basename(req.params.filename);
    const newName = req.body.displayName?.trim();

    const originalExtension = path.extname(filename);
    const newExtension = path.extname(newName);

    if (newExtension.toLowerCase() !== originalExtension.toLowerCase()) {
    return res.status(400).json({
        message: "You must keep the original file extension."
    });
}

    if (!newName) {
        return res.status(400).json({
            message: "Please enter a filename."
        });
    }

    fileMetadata[filename] = {
        ...fileMetadata[filename],
        displayName: newName
    };

    try {
        await fs.promises.writeFile(
            metadataPath,
            JSON.stringify(fileMetadata, null, 2)
        );

        res.json({
            message: "File renamed successfully!",
            displayName: newName
        });
    } catch (error) {
        console.error("File rename failed:", error.message);

        res.status(500).json({
            message: "Unable to rename file."
        });
    }
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