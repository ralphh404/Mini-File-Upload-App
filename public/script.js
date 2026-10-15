const fileInput = document.getElementById("fileInput");
const uploadButton = document.getElementById("uploadButton");

const searchInput = document.getElementById("searchInput");
const folderList = document.getElementById("folderList");
const selectAllFolderFiles = document.getElementById("selectAllFolderFiles");
const folderDestination = document.getElementById("folderDestination");

const folderDestinationDropdown = document.getElementById("folderDestinationDropdown");
const folderDestinationButton = folderDestinationDropdown.querySelector(".folder-dropdown-trigger");
const folderDestinationLabel = folderDestinationButton.querySelector("span");
const folderDestinationMenu = folderDestinationDropdown.querySelector(".folder-dropdown-menu");

const moveFolderFilesButton = document.getElementById("moveFolderFilesButton");
const moveToUploadedFilesButton = document.getElementById("moveToUploadedFilesButton");
const createFolderButton = document.getElementById("createFolderButton");
const destinationFolderDropdown = document.getElementById("destinationFolderDropdown");
const destinationFolderButton = destinationFolderDropdown.querySelector(".folder-dropdown-trigger");
const destinationFolderLabel = destinationFolderButton.querySelector("span");
const destinationFolderMenu = destinationFolderDropdown.querySelector(".folder-dropdown-menu");

let destinationFolderId = "";
const moveSelectedButton = document.getElementById("moveSelectedButton");
const openFolderButton = document.getElementById("openFolderButton");
const deleteFolderButton = document.getElementById("deleteFolderButton");
const selectAllFiles = document.getElementById("selectAllFiles");
const folderContents = document.getElementById("folderContents");
const backToFoldersButton = document.getElementById("backToFoldersButton");
const currentFolderName = document.getElementById("currentFolderName");
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


let selectedFolderId = null;
let currentFolderId = null;
let folders = {};
let filesInsideFolders = [];


async function openFolder(folderId, folderName) {
    currentFolderId = folderId;

    folderList.hidden = true;
    folderContents.hidden = false;
    folderContents.classList.remove("folder-opening");
    void folderContents.offsetWidth;
    folderContents.classList.add("folder-opening");
    currentFolderName.textContent = folderName;

    const response = await fetch("/folders/" + folderId + "/files");
    const files = await response.json();

    const folderFileList = document.getElementById("folderFileList");
    folderFileList.innerHTML = "";


    files.forEach(function(file) {
        const listItem = document.createElement("li");

        const fileCheckbox = document.createElement("input");
        fileCheckbox.type = "checkbox";
        fileCheckbox.classList.add("folder-file-checkbox");
        fileCheckbox.dataset.filename = file.filename;
        listItem.appendChild(fileCheckbox);

        const fileLink = document.createElement("a");
        fileLink.textContent = file.name;
        fileLink.href = "/files/" + encodeURIComponent(file.filename);

        fileLink.addEventListener("click", function(event) {
            if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(file.filename)) {
                event.preventDefault();

                const imageViewer = document.getElementById("imageViewer");
                const previewImage = document.getElementById("previewImage");

                previewImage.src = fileLink.href;
                imageViewer.style.display = "flex";
            } else if (/\.(docx|xlsx|pptx)$/i.test(file.filename)) {
                event.preventDefault();

                if (!file.publicUrl) {
                    alert("This file has no Cloudinary URL. Please upload it again.");
                    return;
                }

                const officeViewerUrl =
                    "https://view.officeapps.live.com/op/view.aspx?src=" +
                    encodeURIComponent(file.publicUrl);

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

        const fileInfo = document.createElement("span");
        fileInfo.textContent =
            " — " + (file.size / 1024).toFixed(1) + " KB (" + file.type + ")";
        listItem.appendChild(fileInfo);

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("file-actions");

        const renameButton = document.createElement("button");
        renameButton.textContent = "Rename";
        renameButton.classList.add("renameButton");

        renameButton.addEventListener("click", async function() {
            const newName = prompt("Enter a new display name:", file.name);

            if (newName === null) return;

            const trimmedName = newName.trim();

            if (!trimmedName) {
                alert("Filename cannot be empty.");
                return;
            }

            const renameResponse = await fetch(
                "/files/" + encodeURIComponent(file.filename),
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ displayName: trimmedName })
                }
            );

            const result = await renameResponse.json();
            alert(result.message);

            if (renameResponse.ok) {
                await openFolder(currentFolderId, currentFolderName.textContent);
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.classList.add("deleteButton");

        deleteButton.addEventListener("click", async function() {
            const confirmed = confirm(
                "Are you sure you want to delete " + file.name + "?"
            );

            if (!confirmed) return;

            const deleteResponse = await fetch(
                "/files/" + encodeURIComponent(file.filename),
                { method: "DELETE" }
            );

            const result = await deleteResponse.json();
            alert(result.message);

            if (deleteResponse.ok) {
                await openFolder(currentFolderId, currentFolderName.textContent);
            }
        });

        buttonGroup.appendChild(renameButton);
        buttonGroup.appendChild(deleteButton);
        listItem.appendChild(buttonGroup);

        folderFileList.appendChild(listItem);
    });
}


async function loadFolders() {
    const response = await fetch("/folders");
    folders = await response.json();

    destinationFolderMenu.innerHTML = "";

    const defaultOption = document.createElement("button");
    defaultOption.type = "button";
    defaultOption.classList.add("folder-dropdown-option");
    defaultOption.textContent = "Choose a folder";
    defaultOption.addEventListener("click", function() {
        destinationFolderId = "";
        destinationFolderLabel.textContent = "Choose a folder";
        destinationFolderMenu.hidden = true;
        destinationFolderButton.setAttribute("aria-expanded", "false");
    });
    destinationFolderMenu.appendChild(defaultOption);

    Object.entries(folders).forEach(function([id, folder]) {
        const option = document.createElement("button");
        option.type = "button";
        option.classList.add("folder-dropdown-option");
        option.textContent = folder.name;

        option.addEventListener("click", function() {
            destinationFolderId = id;
            destinationFolderLabel.textContent = folder.name;
            destinationFolderMenu.hidden = true;
            destinationFolderButton.setAttribute("aria-expanded", "false");
        });

        destinationFolderMenu.appendChild(option);
    });

    
    folderDestination.innerHTML = '<option value="">Choose a folder</option>';
    folderDestinationMenu.innerHTML = "";

    const folderDefaultOption = document.createElement("button");
    folderDefaultOption.type = "button";
    folderDefaultOption.classList.add("folder-dropdown-option");
    folderDefaultOption.textContent = "Choose a folder";

    folderDefaultOption.addEventListener("click", function() {
        folderDestination.value = "";
        folderDestinationLabel.textContent = "Choose a folder";
        folderDestinationMenu.hidden = true;
        folderDestinationButton.setAttribute("aria-expanded", "false");
    });

    folderDestinationMenu.appendChild(folderDefaultOption);

    Object.entries(folders).forEach(function([id, folder]) {
        const selectOption = document.createElement("option");
        selectOption.value = id;
        selectOption.textContent = folder.name;
        folderDestination.appendChild(selectOption);

        const dropdownOption = document.createElement("button");
        dropdownOption.type = "button";
        dropdownOption.classList.add("folder-dropdown-option");
        dropdownOption.textContent = folder.name;

        dropdownOption.addEventListener("click", function() {
            folderDestination.value = id;
            folderDestinationLabel.textContent = folder.name;
            folderDestinationMenu.hidden = true;
            folderDestinationButton.setAttribute("aria-expanded", "false");
        });

        folderDestinationMenu.appendChild(dropdownOption);
    });


    folderList.innerHTML = "";

    const searchTerm = searchInput.value.toLowerCase().trim();

    Object.entries(folders).forEach(function([id, folder]) {
        if (!folder.name.toLowerCase().includes(searchTerm)) {
            return;
        }

        const folderItem = document.createElement("div");
        folderItem.classList.add("folder-item");

        folderItem.textContent = folder.name;
        folderItem.style.cursor = "pointer";

        folderItem.addEventListener("click", function() {
            folderList.querySelectorAll(".folder-item").forEach(function(item) {
                item.classList.remove("selected");
            });

            folderItem.classList.add("selected");
            selectedFolderId = id;
        });

        folderItem.addEventListener("dblclick", function() {
            openFolder(id, folder.name);
        });

        folderList.appendChild(folderItem);
    });
}


        destinationFolderButton.addEventListener("click", function() {
            const isOpening = destinationFolderMenu.hidden;

            destinationFolderMenu.hidden = !isOpening;
            destinationFolderButton.setAttribute("aria-expanded", String(isOpening));
        });

        document.addEventListener("click", function(event) {
            if (!destinationFolderDropdown.contains(event.target)) {
                destinationFolderMenu.hidden = true;
                destinationFolderButton.setAttribute("aria-expanded", "false");
            }
        });

        
        folderDestinationButton.addEventListener("click", function() {
            const isOpening = folderDestinationMenu.hidden;

            folderDestinationMenu.hidden = !isOpening;
            folderDestinationButton.setAttribute("aria-expanded", String(isOpening));
        });

        
        document.addEventListener("click", function(event) {
            if (!folderDestinationDropdown.contains(event.target)) {
                folderDestinationMenu.hidden = true;
                folderDestinationButton.setAttribute("aria-expanded", "false");
            }
        });

        
        backToFoldersButton.addEventListener("click", function() {
            folderContents.classList.remove("folder-opening");

            // If animations are disabled, close immediately.
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                folderContents.hidden = true;
                folderList.hidden = false;
                return;
            }

            folderContents.classList.add("folder-closing");
        });

        folderContents.addEventListener("animationend", function(event) {
            if (
                event.target === folderContents &&
                folderContents.classList.contains("folder-closing")
            ) {
                folderContents.classList.remove("folder-closing");
                folderContents.hidden = true;
                folderList.hidden = false;
            }
        });


openFolderButton.addEventListener("click", function() {
            if (selectedFolderId === null) {
                alert("Please select a folder first.");
                return;
            }

            const selectedFolder = folders[selectedFolderId];

            openFolder(selectedFolderId, selectedFolder.name);
        });

        deleteFolderButton.addEventListener("click", async function() {
            if (selectedFolderId === null) {
                alert("Please select a folder first.");
                return;
            }

            const selectedFolder = folders[selectedFolderId];

            const confirmed = confirm(
                'Delete "' + selectedFolder.name +
                '" and all files inside it permanently?'
            );

            if (!confirmed) {
                return;
            }

            const response = await fetch(
                "/folders/" + encodeURIComponent(selectedFolderId),
                {
                    method: "DELETE"
                }
            );

            const result = await response.json();
            alert(result.message);

            if (response.ok) {
                selectedFolderId = null;
                folderContents.hidden = true;
                folderList.hidden = false;

                await loadFolders();
                await loadFiles();
            }
        });


createFolderButton.addEventListener("click", async function() {
    const folderName = prompt("Enter folder name:");

    if (!folderName || !folderName.trim()) {
        return;
    }

    const response = await fetch("/folders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: folderName
        })
    });

    if (!response.ok) {
        alert("Unable to create folder.");
        return;
    }

    await loadFolders();
});


async function loadFiles() {
    const response = await fetch("/files");
    const files = await response.json();

    const folderEntries = await Promise.all(
        Object.keys(folders).map(async function(folderId) {
            const folderResponse = await fetch(
                "/folders/" + encodeURIComponent(folderId) + "/files"
            );

            if (!folderResponse.ok) {
                return [];
            }

            const folderFiles = await folderResponse.json();

            return folderFiles.map(function(file) {
                return {
                    ...file,
                    folderId: folderId,
                    folderName: folders[folderId].name
                };
            });
        })
    );

    filesInsideFolders = folderEntries.flat();

    const fileList = document.getElementById("fileList");
    fileList.innerHTML = "";
    selectAllFiles.checked = false;
    let displayedFiles = files;

    const searchTerm = searchInput.value.toLowerCase().trim();

    displayedFiles = files.filter(function(file) {
        return file.name.toLowerCase().includes(searchTerm);
    });

    const matchingFolderFiles = filesInsideFolders.filter(function(file) {
        return file.name.toLowerCase().includes(searchTerm);
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
            const fileCheckbox = document.createElement("input");
            fileCheckbox.type = "checkbox";
            fileCheckbox.classList.add("file-checkbox");
            fileCheckbox.dataset.filename = filename;

            listItem.appendChild(fileCheckbox);

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
loadFolders();

    searchInput.addEventListener("input", function() {
        loadFiles();
        loadFolders();
    });

    selectAllFiles.addEventListener("change", function() {
        const fileCheckboxes = document.querySelectorAll(".file-checkbox");

        fileCheckboxes.forEach(function(checkbox) {
            checkbox.checked = selectAllFiles.checked;
        });
    });

    selectAllFolderFiles.addEventListener("change", function() {
        const checkboxes = document.querySelectorAll(".folder-file-checkbox");

        checkboxes.forEach(function(checkbox) {
            checkbox.checked = selectAllFolderFiles.checked;
        });
    });
    

    moveFolderFilesButton.addEventListener("click", async function() {
    const selectedCheckboxes = document.querySelectorAll(
        ".folder-file-checkbox:checked"
    );

    const filenames = Array.from(selectedCheckboxes).map(function(checkbox) {
        return checkbox.dataset.filename;
    });

    const folderId = folderDestination.value;

    if (filenames.length === 0) {
        alert("Please select at least one file.");
        return;
    }

    if (!folderId) {
        alert("Please choose a destination folder.");
        return;
    }

    if (folderId === currentFolderId) {
        alert("Please choose a different folder.");
        return;
    }

    const response = await fetch("/files/move", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filenames: filenames,
            folderId: folderId
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message || "Unable to move files.");
        return;
    }

    alert(result.message);
    selectAllFolderFiles.checked = false;
    folderDestination.value = "";
    folderDestinationLabel.textContent = "Choose a folder";
    await openFolder(currentFolderId, currentFolderName.textContent);
});


moveToUploadedFilesButton.addEventListener("click", async function() {
    const selectedCheckboxes = document.querySelectorAll(
        ".folder-file-checkbox:checked"
    );

    const filenames = Array.from(selectedCheckboxes).map(function(checkbox) {
        return checkbox.dataset.filename;
    });

    if (filenames.length === 0) {
        alert("Please select at least one file.");
        return;
    }

    const confirmed = confirm(
        "Move " + filenames.length + " file(s) back to Uploaded Files?"
    );

    if (!confirmed) {
        return;
    }

    const response = await fetch("/files/move", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filenames: filenames,
            folderId: null
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message || "Unable to move files.");
        return;
    }

    alert(result.message);
    selectAllFolderFiles.checked = false;

    await openFolder(currentFolderId, currentFolderName.textContent);
    await loadFiles();
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

moveSelectedButton.addEventListener("click", async function() {
    const selectedCheckboxes = document.querySelectorAll(
        ".file-checkbox:checked"
    );

    const filenames = Array.from(selectedCheckboxes).map(function(checkbox) {
        return checkbox.dataset.filename;
    });

    const folderId = destinationFolderId;

    if (filenames.length === 0) {
        alert("Please select at least one file.");
        return;
    }

    if (!folderId) {
        alert("Please choose a destination folder.");
        return;
    }

    const response = await fetch("/files/move", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filenames: filenames,
            folderId: folderId
        })
    });

    const result = await response.json();

    if (!response.ok) {
        alert(result.message || "Unable to move files.");
        return;
    }

    alert(result.message);

    selectAllFiles.checked = false;
    destinationFolderId = "";
    destinationFolderLabel.textContent = "Choose a folder";
    await loadFiles();
});