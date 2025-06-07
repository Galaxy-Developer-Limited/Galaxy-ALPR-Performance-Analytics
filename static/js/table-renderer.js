// table-renderer.js - Dynamic Table Rendering from CSV Data
class TableRenderer {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.currentData = [];
    }

    // Render all data to the table
    renderTable() {
        if (!this.dataLoader.isLoaded) {
            console.warn('Data not loaded yet');
            return;
        }

        this.currentData = this.dataLoader.processedData;
        this.clearTable();
        
        if (this.currentData.length === 0) {
            this.showEmptyState();
            return;
        }

        this.currentData.forEach(result => {
            this.addResultRow(result);
        });

        this.updateResultsCount();
    }

    clearTable() {
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
        }
    }

    showEmptyState() {
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div>No data found in galaxy_alpr_performance.csv</div>
                    </td>
                </tr>
            `;
        }
    }

    addResultRow(resultData) {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) return;

        const imageCarousel = this.createImageCarousel(resultData.images);
        
        // Main row
        const mainRow = document.createElement('tr');
        mainRow.className = 'main-row';
        mainRow.setAttribute('data-row-id', resultData.id);
        
        mainRow.innerHTML = `
            <td>
                <button class="expand-btn" onclick="toggleRowDetails('${resultData.id}')" title="Expand details">▶</button>
            </td>
            <td>
                <div class="timestamp-display">
                    <div class="timestamp-date">${resultData.timestamp.date}</div>
                    <div class="timestamp-time">${resultData.timestamp.time}</div>
                </div>
            </td>
            <td>
                <div class="test-cases-compact">
                    ${resultData.testCases.map(tc => `<span class="tag">${tc}</span>`).join('')}
                </div>
            </td>
            <td>
                <div class="images-preview">
                    ${imageCarousel}
                </div>
            </td>
            <td class="accuracy-cell">
                ${this.renderAccuracyBadge(resultData.accuracy)}
            </td>
            <td class="processing-time">${resultData.processingTime.total.toFixed(2)}s</td>
            <td>
                <div class="action-buttons-compact">
                    <button class="btn btn-sm btn-primary toggle-details" onclick="toggleRowDetails('${resultData.id}')">
                        <span class="btn-text">Show Details</span>
                    </button>
                </div>
            </td>
        `;
        
        // Details row (hidden by default)
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'details-row';
        detailsRow.setAttribute('data-details-for', resultData.id);
        detailsRow.style.display = 'none';
        
        detailsRow.innerHTML = `
            <td colspan="7">
                <div class="row-details">
                    ${this.renderDetailedSection('🚗 Vehicle Detection', resultData, 'vehicle')}
                    ${this.renderDetailedSection('🏷️ Plate Detection', resultData, 'plate')}
                    ${this.renderDetailedSection('🔤 Plate OCR', resultData, 'ocr')}
                    
                    <div class="details-actions">
                        <button class="btn btn-secondary" onclick="toggleRowDetails('${resultData.id}')">Close Details</button>
                    </div>
                </div>
            </td>
        `;
        
        tableBody.appendChild(mainRow);
        tableBody.appendChild(detailsRow);
    }

    renderDetailedSection(title, resultData, type) {
        let imageSrc, predicted, actual, confidence, processingTime;
        
        switch(type) {
            case 'vehicle':
                imageSrc = resultData.croppedImages.vehicle;
                predicted = resultData.predictions.vehicleClass;
                actual = resultData.actual.vehicleClass;
                confidence = resultData.confidence ? resultData.confidence.vehicle : 0.95;
                processingTime = resultData.processingTime ? resultData.processingTime.vehicle : 0.5;
                break;
            case 'plate':
                imageSrc = resultData.croppedImages.plate;
                predicted = resultData.predictions.plateClass;
                actual = resultData.actual.plateClass;
                confidence = resultData.confidence ? resultData.confidence.plate : 0.85;
                processingTime = resultData.processingTime ? resultData.processingTime.plateDetection : 1.0;
                break;
            case 'ocr':
                imageSrc = resultData.croppedImages.plate;
                predicted = resultData.predictions.plateNumber;
                actual = resultData.actual.plateNumber;
                confidence = resultData.confidence ? resultData.confidence.ocr : 0.90;
                processingTime = resultData.processingTime ? resultData.processingTime.plateRecognition : 0.75;
                break;
        }

        const isMatch = predicted === actual;
        const matchClass = isMatch ? 'match' : 'mismatch';

        return `
            <div class="details-section">
                <h4>${title}</h4>
                <div class="detection-card">
                    <div class="cropped-image-container">
                        <img src="${imageSrc}" alt="Cropped ${type}" class="cropped-image" 
                             onclick="openImageModal('${imageSrc}', '${title} Image')"
                             onerror="this.src='https://via.placeholder.com/140x90/f1f5f9/64748b?text=No+Image'">
                        <div class="image-label">Cropped ${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                    </div>
                    <div class="comparison-container ${matchClass}">
                        <div class="comparison-item">
                            <div class="comparison-label">Predicted</div>
                            <div class="predicted-value">${predicted || 'N/A'}</div>
                            <div class="confidence-score">Confidence: ${(confidence * 100).toFixed(1)}%</div>
                        </div>
                        <div class="vs-separator">${isMatch ? '✓' : '✗'}</div>
                        <div class="comparison-item">
                            <div class="comparison-label">Actual</div>
                            <div class="actual-value">${actual || 'N/A'}</div>
                            <div class="processing-time-info">Time: ${processingTime.toFixed(3)}s</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAccuracyBadge(accuracy) {
        const percentage = accuracy.percentage;
        let className, icon;
        
        if (percentage >= 90) {
            className = 'accuracy-high';
            icon = '🎯';
        } else if (percentage >= 70) {
            className = 'accuracy-medium';
            icon = '⚠️';
        } else {
            className = 'accuracy-low';
            icon = '❌';
        }

        return `
            <span class="${className}">
                ${icon} ${percentage}%
            </span>
            <div class="accuracy-breakdown">
                <div class="breakdown-item ${accuracy.vehicleMatch ? 'correct' : 'incorrect'}">
                    V: ${accuracy.vehicleMatch ? '✓' : '✗'}
                </div>
                <div class="breakdown-item ${accuracy.plateClassMatch ? 'correct' : 'incorrect'}">
                    P: ${accuracy.plateClassMatch ? '✓' : '✗'}
                </div>
                <div class="breakdown-item ${accuracy.plateNumberMatch ? 'correct' : 'incorrect'}">
                    N: ${accuracy.plateNumberMatch ? '✓' : '✗'}
                </div>
            </div>
        `;
    }

    createImageCarousel(images) {
        const carouselId = `carousel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="image-carousel" id="${carouselId}">
                <div class="carousel-container">
                    <button class="carousel-btn prev" onclick="changeCarouselImage('${carouselId}', -1)">&lt;</button>
                    <img class="carousel-image" 
                         src="${images[0].src}" 
                         alt="${images[0].alt}" 
                         data-current-index="0"
                         data-images='${JSON.stringify(images).replace(/'/g, "&apos;")}'
                         onerror="this.src='https://via.placeholder.com/80x60/f1f5f9/64748b?text=No+Image'">
                    <button class="carousel-btn next" onclick="changeCarouselImage('${carouselId}', 1)">&gt;</button>
                </div>
                <div class="carousel-indicators">
                    ${images.map((img, idx) => `
                        <span class="indicator ${idx === 0 ? 'active' : ''}" 
                              onclick="setCarouselImage('${carouselId}', ${idx})" 
                              title="${img.alt}">
                            ${img.label}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateResultsCount() {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            const count = this.currentData.length;
            resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        }
    }

    // Filter and search functionality
    filterData(searchTerm = '', testCaseFilter = '') {
        if (!this.dataLoader.isLoaded) return;

        let filteredData = this.dataLoader.processedData;

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredData = filteredData.filter(item => 
                item.filename.toLowerCase().includes(term) ||
                item.predictions.vehicleClass.toLowerCase().includes(term) ||
                item.predictions.plateNumber.toLowerCase().includes(term) ||
                item.testCases.some(tc => tc.toLowerCase().includes(term))
            );
        }

        // Apply test case filter
        if (testCaseFilter) {
            filteredData = filteredData.filter(item => 
                item.testCases.some(tc => tc.includes(testCaseFilter))
            );
        }

        this.currentData = filteredData;
        this.renderFilteredTable();
    }

    renderFilteredTable() {
        this.clearTable();
        
        if (this.currentData.length === 0) {
            this.showEmptyState();
            return;
        }

        this.currentData.forEach(result => {
            this.addResultRow(result);
        });

        this.updateResultsCount();
    }

    // Export current data
    exportCurrentData() {
        const csvContent = this.convertToCSV(this.currentData);
        this.downloadCSV(csvContent, 'filtered_alpr_results.csv');
    }

    convertToCSV(data) {
        if (!data.length) return '';

        const headers = [
            'Timestamp', 'Filename', 'Test Cases', 'Vehicle Predicted', 'Vehicle Actual', 
            'Plate Predicted', 'Plate Actual', 'Plate Number Predicted', 'Plate Number Actual',
            'Accuracy %', 'Processing Time (s)'
        ];

        const rows = data.map(item => [
            item.timestamp.iso,
            item.filename,
            item.testCases.join('; '),
            item.predictions.vehicleClass,
            item.actual.vehicleClass,
            item.predictions.plateClass,
            item.actual.plateClass,
            item.predictions.plateNumber,
            item.actual.plateNumber,
            item.accuracy.percentage,
            item.processingTime.total.toFixed(3)
        ]);

        return [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// Enhanced carousel functions for dynamic IDs
window.changeCarouselImage = function(carouselId, direction) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const img = carousel.querySelector('.carousel-image');
    const indicators = carousel.querySelectorAll('.indicator');
    const images = JSON.parse(img.dataset.images.replace(/&apos;/g, "'"));
    
    let currentIndex = parseInt(img.dataset.currentIndex || 0);
    currentIndex = (currentIndex + direction + images.length) % images.length;
    
    img.src = images[currentIndex].src;
    img.alt = images[currentIndex].alt;
    img.dataset.currentIndex = currentIndex;
    
    indicators.forEach((indicator, idx) => {
        indicator.classList.toggle('active', idx === currentIndex);
    });
};

window.setCarouselImage = function(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const img = carousel.querySelector('.carousel-image');
    const indicators = carousel.querySelectorAll('.indicator');
    const images = JSON.parse(img.dataset.images.replace(/&apos;/g, "'"));
    
    img.src = images[index].src;
    img.alt = images[index].alt;
    img.dataset.currentIndex = index;
    
    indicators.forEach((indicator, idx) => {
        indicator.classList.toggle('active', idx === index);
    });
};

// Create global instance (will be initialized after data is loaded)
window.tableRenderer = null;