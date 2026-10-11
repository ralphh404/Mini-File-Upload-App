const fileInput = document.getElementById("fileInput");
const uploadButton = document.getElementById("uploadButton");

const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");


const sortDropdown = document.getElementById("sortDropdown");
const sortButton = document.getElementById("sortButton");
const sortLabel = document.getElementById("sortLabel");
const sortMenu = document.getElementById("sortMenu");
const sortOptions = document.querySelectorAll(".sort-option");

    function closeSortMenu() {
        sortDropdown.classList.remove("open");
        sortButton.setAttribute("aria-expanded", "false");
    }

    sortButton.addEventListener("click", function() {
        const isOpen = sortDropdown.classList.toggle("open");
        sortButton.setAttribute("aria-expanded", String(isOpen));
    });

    sortOptions.forEach(function(option) {
        option.addEventListener("click", function() {
            const selectedValue = option.dataset.value;

            sortSelect.value = selectedValue;
            sortLabel.textContent = option.textContent.trim();

            sortOptions.forEach(function(item) {
                const isSelected = item === option;
                item.classList.toggle("selected", isSelected);
                item.setAttribute("aria-selected", String(isSelected));
            });

            closeSortMenu();
            loadFiles();
        });
    });

    document.addEventListener("click", function(event) {
        if (!sortDropdown.contains(event.target)) {
            closeSortMenu();
        }
    });

    sortButton.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            closeSortMenu();
        }
    });



uploadButton.addEventListener("click", function() {
    const files = fileInput.files;

    if (files.length === 0) {
        alert("Please select at least one file!");
        return;
    }

    if (files.length > 10) {
        alert("You can upload a maximum of 10 files at once.");
        return;
    }

    const formData = new FormData();

    for (const file of files) {
        formData.append("files", file);
    }

    const xhr = new XMLHttpRequest();

    const uploadProgress = document.getElementById("uploadProgress");
    const progressText = document.getElementById("progressText");

    uploadProgress.value = 0;
    progressText.textContent = "0%";

    xhr.upload.addEventListener("progress", function(event) {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);

            uploadProgress.value = percent;
            progressText.textContent = percent + "%";
        }
    });

    xhr.addEventListener("load", function() {
        uploadButton.disabled = false;
        uploadButton.textContent = "Upload File";
        
        let result;

        try {
            result = JSON.parse(xhr.responseText);
        } catch {
            alert("The server returned an invalid response.");
            return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
            alert(result.message);
            loadFiles();
            fileInput.value = "";
        } else {
            alert(result.message || "Upload failed.");
        }
    });

    xhr.addEventListener("error", function() {
        uploadButton.disabled = false;
        uploadButton.textContent = "Upload File";

        alert("A network error occurred during upload.");
    });

    uploadButton.disabled = true;
    uploadButton.textContent = "Uploading...";
    xhr.open("POST", "/upload");
    xhr.send(formData);
});


async function loadFiles() {
    const response = await fetch("/files");
    const files = await response.json();

    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";
    let displayedFiles = files;

    
    displayedFiles = files.filter(function(file) {
            return file.name.toLowerCase().includes(
                searchInput.value.toLowerCase().trim()
            );
        });

        const sortOption = sortSelect.value;

    displayedFiles.sort(function(a, b) {
        if (sortOption === "name") {
            return a.name.localeCompare(b.name);
        }

        if (sortOption === "size") {
            return a.size - b.size;
        }

        if (sortOption === "date") {
            return new Date(b.modifiedAt) - new Date(a.modifiedAt);
        }
    });

    displayedFiles.forEach(function(file) {
            const filename = file.filename;
            const displayName = file.name;

            const listItem = document.createElement("li");

            const fileLink = document.createElement("a");
            
            fileLink.textContent = displayName;
            fileLink.href = "/files/" + encodeURIComponent(filename);

            fileLink.addEventListener("click", function(event) {
                if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename)) {
                    event.preventDefault();

                    const imageViewer = document.getElementById("imageViewer");
                    const previewImage = document.getElementById("previewImage");

                    previewImage.src = fileLink.href;
                    imageViewer.style.display = "flex";
                }

                else if (/\.(docx|xlsx|pptx)$/i.test(filename)) {
                    event.preventDefault();

                    const publicFileUrl = file.publicUrl;

                    if (!publicFileUrl) {
                        alert("This file has no Cloudinary URL. Please upload it again.");
                        return;
                    }

                    const officeViewerUrl =
                        "https://view.officeapps.live.com/op/view.aspx?src=" +
                        encodeURIComponent(publicFileUrl);

                    documentContent.innerHTML = "";

                    const iframe = document.createElement("iframe");
                    iframe.src = officeViewerUrl;
                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    iframe.style.border = "none";

                    documentContent.appendChild(iframe);
                    documentViewer.style.display = "flex";
                }
            });

            listItem.appendChild(fileLink);

            const buttonGroup = document.createElement("div");
            buttonGroup.classList.add("file-actions");
            const renameButton = document.createElement("button");
            renameButton.textContent = "Rename";
            renameButton.classList.add("renameButton");

            renameButton.addEventListener("click", async function() {
                const newName = prompt("Enter a new display name:", displayName);

                if (newName === null) {
                    return;
                }

                const trimmedName = newName.trim();

                if (!trimmedName) {
                    alert("Filename cannot be empty.");
                    return;
                }

                const response = await fetch("/files/" + encodeURIComponent(filename), {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        displayName: trimmedName
                    })
                });

                const result = await response.json();
                alert(result.message);

                if (response.ok) {
                    loadFiles();
                }
            });

            buttonGroup.appendChild(renameButton);

            const fileInfo = document.createElement("span");
            fileInfo.textContent =
                " — " + (file.size / 1024).toFixed(1) + " KB (" + file.type + ")";

            listItem.appendChild(fileInfo);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.classList.add("deleteButton");

            deleteButton.addEventListener("click", async function() {
                const confirmed = confirm("Are you sure you want to delete " + filename + "?");

                if (!confirmed) {
                    return;
                }

                const response = await fetch("/files/" + encodeURIComponent(filename), {
                    method: "DELETE"
                });

                const result = await response.json();

                alert(result.message);
                loadFiles();
            });

            buttonGroup.appendChild(deleteButton);
            listItem.appendChild(buttonGroup);
            fileList.appendChild(listItem);
        });

}

loadFiles();

    searchInput.addEventListener("input", function() {
        loadFiles();
    });


const imageViewer = document.getElementById("imageViewer");
const previewImage = document.getElementById("previewImage");
const closeViewer = document.getElementById("closeViewer");

const documentViewer = document.getElementById("documentViewer");
const documentContent = document.getElementById("documentContent");


closeViewer.addEventListener("click", function() {
    imageViewer.classList.add("closing");

    setTimeout(function() {
        imageViewer.style.display = "none";
        imageViewer.classList.remove("closing");
        previewImage.src = "";
    }, 220);
});


const closeDocumentViewer = document.getElementById("closeDocumentViewer");

closeDocumentViewer.addEventListener("click", function() {
    documentViewer.classList.add("closing");

    setTimeout(function() {
        documentViewer.style.display = "none";
        documentViewer.classList.remove("closing");
        documentContent.innerHTML = "";
    }, 220);
});

