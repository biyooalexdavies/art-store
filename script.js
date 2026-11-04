/**
 * Art Collection Manager
 * Pure client-side application with localStorage persistence and client-side image storage.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Storage & State Management
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'art_collection_items';

  let artworks = loadArtworks();
  let editingId = null;
  let currentImageDataUrl = null;

  function loadArtworks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to load art collection from localStorage:', err);
      return [];
    }
  }

  function saveArtworks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(artworks));
    } catch (err) {
      console.error('Failed to save art collection to localStorage:', err);
      alert('Unable to save changes. Your browser storage might be full.');
    }
  }

  // ---------------------------------------------------------------------------
  // DOM Elements
  // ---------------------------------------------------------------------------
  const totalCountEl = document.getElementById('totalCount');
  const counterLabelEl = document.getElementById('counterLabel');
  const artListEl = document.getElementById('artList');
  const emptyStateEl = document.getElementById('emptyState');
  const noResultsStateEl = document.getElementById('noResultsState');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const statusFilter = document.getElementById('statusFilter');

  const openAddModalBtn = document.getElementById('openAddModalBtn');
  const emptyAddBtn = document.getElementById('emptyAddBtn');
  const resetSearchBtn = document.getElementById('resetSearchBtn');

  // Modal Elements
  const artworkModal = document.getElementById('artworkModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const artworkForm = document.getElementById('artworkForm');
  const modalTitle = document.getElementById('modalTitle');
  const saveArtworkBtn = document.getElementById('saveArtworkBtn');

  // Image Upload Elements
  const artworkImageInput = document.getElementById('artworkImageInput');
  const imageUploadDropzone = document.getElementById('imageUploadDropzone');
  const imagePreviewBox = document.getElementById('imagePreviewBox');
  const imagePreview = document.getElementById('imagePreview');
  const removeImageBtn = document.getElementById('removeImageBtn');

  // Form Fields
  const artworkIdInput = document.getElementById('artworkId');
  const artworkTitleInput = document.getElementById('artworkTitle');
  const artworkArtistInput = document.getElementById('artworkArtist');
  const artworkTypeSelect = document.getElementById('artworkType');
  const artworkYearInput = document.getElementById('artworkYear');
  const artworkMediumInput = document.getElementById('artworkMedium');
  const artworkSizeInput = document.getElementById('artworkSize');
  const titleError = document.getElementById('titleError');
  const artistError = document.getElementById('artistError');

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateId() {
    return 'art_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  // ---------------------------------------------------------------------------
  // Image Processing & Compression (Canvas Resize for Storage Efficiency)
  // ---------------------------------------------------------------------------
  function setImagePreview(dataUrl) {
    currentImageDataUrl = dataUrl || null;
    if (dataUrl) {
      imagePreview.src = dataUrl;
      imagePreviewBox.hidden = false;
      imageUploadDropzone.hidden = true;
    } else {
      imagePreview.src = '';
      imagePreviewBox.hidden = true;
      imageUploadDropzone.hidden = false;
      artworkImageInput.value = '';
    }
  }

  function processImageFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP, or GIF).');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Optimize and scale down to max 1000px so localStorage does not get bloated
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG
        const optimizedUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImagePreview(optimizedUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // File input change
  artworkImageInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      processImageFile(this.files[0]);
    }
  });

  // Dropzone click & keyboard access
  imageUploadDropzone.addEventListener('click', () => artworkImageInput.click());
  imageUploadDropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      artworkImageInput.click();
    }
  });

  // Drag and drop handlers
  ['dragenter', 'dragover'].forEach((eventName) => {
    imageUploadDropzone.addEventListener(eventName, function (e) {
      e.preventDefault();
      e.stopPropagation();
      imageUploadDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    imageUploadDropzone.addEventListener(eventName, function (e) {
      e.preventDefault();
      e.stopPropagation();
      imageUploadDropzone.classList.remove('dragover');
    });
  });

  imageUploadDropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  });

  // Remove image button
  removeImageBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setImagePreview(null);
  });

  // ---------------------------------------------------------------------------
  // Render Logic
  // ---------------------------------------------------------------------------
  function render() {
    const totalCount = artworks.length;
    totalCountEl.textContent = totalCount;
    counterLabelEl.textContent = totalCount === 1 ? 'Artwork' : 'Artworks';

    const searchTerm = searchInput.value.trim().toLowerCase();
    const statusVal = statusFilter.value;

    // Toggle clear search button
    clearSearchBtn.hidden = searchTerm.length === 0;

    // Filter artworks
    const filtered = artworks.filter((item) => {
      // Status filter
      if (statusVal !== 'all' && item.status !== statusVal) {
        return false;
      }

      // Search term query
      if (searchTerm) {
        const titleMatch = (item.title || '').toLowerCase().includes(searchTerm);
        const artistMatch = (item.artist || '').toLowerCase().includes(searchTerm);
        const mediumMatch = (item.medium || '').toLowerCase().includes(searchTerm);
        const typeMatch = (item.type || '').toLowerCase().includes(searchTerm);
        const yearMatch = (item.year ? String(item.year) : '').toLowerCase().includes(searchTerm);
        const sizeMatch = (item.size || '').toLowerCase().includes(searchTerm);

        if (!titleMatch && !artistMatch && !mediumMatch && !typeMatch && !yearMatch && !sizeMatch) {
          return false;
        }
      }

      return true;
    });

    // Handle view states
    if (totalCount === 0) {
      artListEl.innerHTML = '';
      emptyStateEl.hidden = false;
      noResultsStateEl.hidden = true;
      return;
    }

    emptyStateEl.hidden = true;

    if (filtered.length === 0) {
      artListEl.innerHTML = '';
      noResultsStateEl.hidden = false;
      return;
    }

    noResultsStateEl.hidden = true;

    // Render cards
    artListEl.innerHTML = filtered
      .map((item) => {
        const isSold = item.status === 'Sold Out';
        const statusBadgeClass = isSold ? 'sold-out' : 'in-stock';
        const statusLabel = isSold ? 'Sold Out' : 'In Stock';

        const imageHtml = item.image
          ? `<div class="card-image-wrap">
               <img src="${item.image}" alt="${escapeHTML(item.title)}" class="card-image" loading="lazy">
             </div>`
          : '';

        const mediumHtml = item.medium
          ? `<div class="detail-item full-width">
               <span class="detail-label">Medium</span>
               <span class="detail-value">${escapeHTML(item.medium)}</span>
             </div>`
          : '';

        const sizeHtml = item.size
          ? `<div class="detail-item">
               <span class="detail-label">Size</span>
               <span class="detail-value">${escapeHTML(item.size)}</span>
             </div>`
          : `<div class="detail-item">
               <span class="detail-label">Size</span>
               <span class="detail-value" style="color: var(--text-muted); font-style: italic;">Not specified</span>
             </div>`;

        const yearHtml = item.year
          ? `<div class="detail-item">
               <span class="detail-label">Year</span>
               <span class="detail-value">${escapeHTML(item.year)}</span>
             </div>`
          : `<div class="detail-item">
               <span class="detail-label">Year</span>
               <span class="detail-value" style="color: var(--text-muted); font-style: italic;">Unknown</span>
             </div>`;

        return `
          <article class="art-card" data-id="${item.id}" role="listitem">
            <div>
              ${imageHtml}
              <div class="card-top">
                <span class="card-type-tag">${escapeHTML(item.type || 'Artwork')}</span>
                <span class="status-badge ${statusBadgeClass}">
                  <span class="dot" aria-hidden="true"></span>
                  ${statusLabel}
                </span>
              </div>

              <div class="card-header">
                <h3 class="card-title">${escapeHTML(item.title)}</h3>
                <p class="card-artist">${escapeHTML(item.artist)}</p>
              </div>

              <div class="card-details">
                ${mediumHtml}
                ${sizeHtml}
                ${yearHtml}
              </div>
            </div>

            <div class="card-actions">
              <button type="button" class="btn btn-card btn-edit" data-action="edit" data-id="${item.id}" aria-label="Edit ${escapeHTML(item.title)}">
                Edit
              </button>
              <button type="button" class="btn btn-card btn-delete" data-action="delete" data-id="${item.id}" aria-label="Delete ${escapeHTML(item.title)}">
                Delete
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ---------------------------------------------------------------------------
  // Modal Handlers
  // ---------------------------------------------------------------------------
  function openModal(mode = 'add', artwork = null) {
    clearErrors();
    artworkForm.reset();

    if (mode === 'edit' && artwork) {
      editingId = artwork.id;
      modalTitle.textContent = 'Edit Artwork';
      saveArtworkBtn.textContent = 'Update Artwork';

      artworkIdInput.value = artwork.id;
      artworkTitleInput.value = artwork.title || '';
      artworkArtistInput.value = artwork.artist || '';
      artworkTypeSelect.value = artwork.type || 'Painting';
      artworkYearInput.value = artwork.year || '';
      artworkMediumInput.value = artwork.medium || '';
      artworkSizeInput.value = artwork.size || '';

      const statusRadio = artworkForm.querySelector(`input[name="status"][value="${artwork.status}"]`);
      if (statusRadio) {
        statusRadio.checked = true;
      }

      setImagePreview(artwork.image || null);
    } else {
      editingId = null;
      modalTitle.textContent = 'Add New Artwork';
      saveArtworkBtn.textContent = 'Save Artwork';
      artworkIdInput.value = '';
      const defaultRadio = artworkForm.querySelector('input[name="status"][value="In Stock"]');
      if (defaultRadio) defaultRadio.checked = true;

      setImagePreview(null);
    }

    artworkModal.hidden = false;
    // Trigger transition after unhiding
    requestAnimationFrame(() => {
      artworkModal.classList.add('active');
      artworkTitleInput.focus();
    });
  }

  function closeModal() {
    artworkModal.classList.remove('active');
    setTimeout(() => {
      artworkModal.hidden = true;
      artworkForm.reset();
      clearErrors();
      setImagePreview(null);
      editingId = null;
    }, 200);
  }

  function clearErrors() {
    titleError.textContent = '';
    artistError.textContent = '';
    artworkTitleInput.classList.remove('input-error');
    artworkArtistInput.classList.remove('input-error');
  }

  // ---------------------------------------------------------------------------
  // Form Submission (Add / Edit)
  // ---------------------------------------------------------------------------
  artworkForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    const title = artworkTitleInput.value.trim();
    const artist = artworkArtistInput.value.trim();
    const type = artworkTypeSelect.value;
    const year = artworkYearInput.value.trim();
    const medium = artworkMediumInput.value.trim();
    const size = artworkSizeInput.value.trim();
    const statusRadio = artworkForm.querySelector('input[name="status"]:checked');
    const status = statusRadio ? statusRadio.value : 'In Stock';
    const image = currentImageDataUrl;

    let hasError = false;

    if (!title) {
      titleError.textContent = 'Please enter an artwork title.';
      artworkTitleInput.classList.add('input-error');
      hasError = true;
    }

    if (!artist) {
      artistError.textContent = 'Please enter the artist name.';
      artworkArtistInput.classList.add('input-error');
      hasError = true;
    }

    if (hasError) return;

    if (editingId) {
      // Edit existing artwork
      const index = artworks.findIndex((item) => item.id === editingId);
      if (index !== -1) {
        artworks[index] = {
          ...artworks[index],
          title,
          artist,
          type,
          year,
          medium,
          size,
          status,
          image,
          updatedAt: Date.now()
        };
      }
    } else {
      // Add new artwork
      const newArtwork = {
        id: generateId(),
        title,
        artist,
        type,
        year,
        medium,
        size,
        status,
        image,
        createdAt: Date.now()
      };
      artworks.unshift(newArtwork);
    }

    saveArtworks();
    closeModal();
    render();
  });

  // ---------------------------------------------------------------------------
  // Event Delegation for Edit & Delete on Cards
  // ---------------------------------------------------------------------------
  artListEl.addEventListener('click', function (e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const artwork = artworks.find((item) => item.id === id);

    if (!artwork) return;

    if (action === 'edit') {
      openModal('edit', artwork);
    } else if (action === 'delete') {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${artwork.title}" by ${artwork.artist}?\n\nThis action cannot be undone.`
      );

      if (confirmed) {
        artworks = artworks.filter((item) => item.id !== id);
        saveArtworks();
        render();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Search & Filters Listeners
  // ---------------------------------------------------------------------------
  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);

  clearSearchBtn.addEventListener('click', function () {
    searchInput.value = '';
    render();
    searchInput.focus();
  });

  resetSearchBtn.addEventListener('click', function () {
    searchInput.value = '';
    statusFilter.value = 'all';
    render();
  });

  // ---------------------------------------------------------------------------
  // Modal Buttons & Hotkeys
  // ---------------------------------------------------------------------------
  openAddModalBtn.addEventListener('click', () => openModal('add'));
  emptyAddBtn.addEventListener('click', () => openModal('add'));
  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  // Close when clicking outside modal box
  artworkModal.addEventListener('click', function (e) {
    if (e.target === artworkModal) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !artworkModal.hidden) {
      closeModal();
    }
  });

  // ---------------------------------------------------------------------------
  // Initial Boot
  // ---------------------------------------------------------------------------
  render();
})();
