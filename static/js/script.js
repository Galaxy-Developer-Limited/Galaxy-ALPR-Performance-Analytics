// Galaxy ALPR Performance Dashboard - Main Application
// Fixed version with OCR comparison fix and color adjustments

    // Global variables - only declare once
if (!window.GalaxyALPRInitialized) {
    window.GalaxyALPRInitialized = true;
    window.dataLoader = null;
    window.statisticsCalculator = null;
    window.tableRenderer = null;
    window.currentPage = 1;
    window.itemsPerPage = 10;
    window.allData = [];
    window.filteredData = [];

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Galaxy ALPR Dashboard initializing...');
        initializeTabs();
        initializeModal();
        initializeFilters(); // Add filter initialization
        loadCSVData();
    });

    // Simple built-in CSV loader
    class SimpleCSVLoader {
        constructor() {
            this.data = [];
            this.isLoaded = false;
        }

        async loadCSV(csvPath = 'galaxy_alpr_performance.csv') {
            try {
                console.log('Loading CSV with SimpleCSVLoader...');
                const response = await fetch(csvPath);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const csvText = await response.text();
                console.log('CSV loaded, length:', csvText.length);
                
                this.data = this.parseCSV(csvText);
                this.isLoaded = true;
                
                console.log(`Parsed ${this.data.length} records`);
                return this.data;
            } catch (error) {
                console.error('Error loading CSV:', error);
                return [];
            }
        }

        parseCSV(csvText) {
            const lines = csvText.trim().split('\n');
            const headers = lines[0].split(',');
            const data = [];

            console.log('Headers:', headers);
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    const values = lines[i].split(',');
                    const row = {};
                    
                    headers.forEach((header, index) => {
                        row[header.trim()] = values[index] ? values[index].trim() : '';
                    });
                    
                    // Add raw data for test case calculations
                    const processedRow = {
                        id: `result-${i}`,
                        timestamp: this.parseTimestamp(row.timestamp),
                        filename: row.filename,
                        testCases: this.extractTestCases(row),
                        specialCases: this.extractSpecialCases(row), // Add special cases
                        images: [
                            { src: row.path_original_image, alt: 'Original Image', label: 'O' },
                            { src: row.path_detected_image, alt: 'Detected Image', label: 'D' }
                        ],
                        croppedImages: {
                            vehicle: row.path_cropped_vehicle,
                            plate: row.path_cropped_plate
                        },
                        predictions: {
                            vehicleClass: row.predicted_class_vehicle,
                            plateClass: row.predicted_class_plate,
                            plateNumber: row.predicted_plate_number
                        },
                        actual: {
                            vehicleClass: row.actual_class_vehicle,
                            plateClass: row.actual_class_plate,
                            plateNumber: row.actual_plate_number
                        },
                        confidence: {
                            vehicle: parseFloat(row.confidence_score_vehicle_detection) || 0,
                            plate: parseFloat(row.confidence_score_plate_detection) || 0,
                            ocr: parseFloat(row.confidence_score_plate_ocr) || 0
                        },
                        processingTime: {
                            vehicle: parseFloat(row.processing_time_vehicle_detection) / 1000 || 0, // Convert ms to seconds
                            plateDetection: parseFloat(row.processing_time_plate_detection) / 1000 || 0,
                            plateRecognition: parseFloat(row.processing_time_plate_recognition) / 1000 || 0,
                            total: ((parseFloat(row.processing_time_vehicle_detection) || 0) + 
                                   (parseFloat(row.processing_time_plate_detection) || 0) + 
                                   (parseFloat(row.processing_time_plate_recognition) || 0)) / 1000 // Convert total ms to seconds
                        },
                        accuracy: this.calculateAccuracy(row),
                        rawData: row // Keep raw data for test case filtering
                    };
                    
                    data.push(processedRow);
                }
            }
            
            return data;
        }

        parseTimestamp(timestamp) {
            try {
                const date = new Date(timestamp);
                return {
                    iso: timestamp,
                    date: date.toLocaleDateString('en-US'),
                    time: date.toLocaleTimeString('en-US'),
                    full: date
                };
            } catch (error) {
                return {
                    iso: timestamp,
                    date: 'Invalid Date',
                    time: 'Invalid Time',
                    full: new Date()
                };
            }
        }

        extractTestCases(row) {
            const testCases = [];
            
            // Using lowercase for test cases as requested
            if (row.test_case_image_quality) {
                testCases.push(`quality-${row.test_case_image_quality.toLowerCase()}`);
            }
            if (row.test_case_image_lighting) {
                testCases.push(`lighting-${row.test_case_image_lighting.toLowerCase()}`);
            }
            if (row.test_case_image_resolution) {
                testCases.push(`resolution-${row.test_case_image_resolution.toLowerCase()}`);
            }
            if (row.test_case_object_count) {
                testCases.push(`count-${row.test_case_object_count.toLowerCase()}`);
            }
            if (row.test_case_vehicle_distance) {
                testCases.push(`distance-${row.test_case_vehicle_distance.toLowerCase()}`);
            }
            if (row.test_case_camera_angle) {
                testCases.push(`angle-${row.test_case_camera_angle.toLowerCase()}`);
            }
            
            return testCases;
        }

        extractSpecialCases(row) {
            const specialCases = [];
            
            // Add special case if it exists and is not empty
            if (row.special_case && row.special_case.trim() !== '') {
                specialCases.push(row.special_case.trim());
            }
            
            return specialCases;
        }

        calculateAccuracy(row) {
            const vehicleMatch = row.predicted_class_vehicle === row.actual_class_vehicle;
            const plateClassMatch = row.predicted_class_plate === row.actual_class_plate;
            
            // FIXED: Character-level matching for OCR accuracy with empty field handling
            const plateNumberMatch = this.calculateCharacterMatch(row.predicted_plate_number, row.actual_plate_number);

            // Calculate individual accuracies
            const vehicleAccuracy = vehicleMatch ? 100 : 0;
            const plateDetectionAccuracy = plateClassMatch ? 100 : 0;
            const plateOcrAccuracy = plateNumberMatch.charAccuracy; // Use character matching accuracy

            // Overall average accuracy (average of all three components)
            const overallAverageAccuracy = Math.round((vehicleAccuracy + plateDetectionAccuracy + plateOcrAccuracy) / 3);

            return {
                percentage: overallAverageAccuracy, // This is now the overall average accuracy
                vehicleMatch,
                plateClassMatch,
                plateNumberMatch: plateNumberMatch.isExactMatch,
                plateNumberCharAccuracy: plateNumberMatch.charAccuracy,
                vehicleAccuracy,
                plateDetectionAccuracy,
                plateOcrAccuracy
            };
        }

        calculateCharacterMatch(predicted, actual) {
            // FIXED: Handle empty fields properly - both empty should be 100% accurate
            const cleanPredicted = (predicted || '').replace(/\s+/g, '').toUpperCase();
            const cleanActual = (actual || '').replace(/\s+/g, '').toUpperCase();

            // If both are empty, it's a perfect match (100% accuracy)
            if (cleanPredicted === '' && cleanActual === '') {
                return { isExactMatch: true, charAccuracy: 100 };
            }

            // If one is empty and the other is not, it's a mismatch
            if ((cleanPredicted === '' && cleanActual !== '') || (cleanPredicted !== '' && cleanActual === '')) {
                return { isExactMatch: false, charAccuracy: 0 };
            }

            // Exact match check
            const isExactMatch = cleanPredicted === cleanActual;

            // Character-level accuracy calculation
            const maxLength = Math.max(cleanPredicted.length, cleanActual.length);
            if (maxLength === 0) return { isExactMatch: false, charAccuracy: 0 };

            let matchingChars = 0;
            for (let i = 0; i < maxLength; i++) {
                if (cleanPredicted[i] === cleanActual[i]) {
                    matchingChars++;
                }
            }

            const charAccuracy = Math.round((matchingChars / maxLength) * 100);

            return { isExactMatch, charAccuracy };
        }

        getSummaryStats() {
            if (!this.data.length) return { totalDetections: 0, vehicleCount: 0, plateCount: 0, overallAverageAccuracy: 0, avgProcessingTime: 0 };

            const totalDetections = this.data.length;
            const vehicleCount = this.data.length;
            const plateCount = this.data.filter(item => item.predictions.plateNumber && item.predictions.plateNumber.trim()).length;
            const totalAccuracy = this.data.reduce((sum, item) => sum + item.accuracy.percentage, 0) / totalDetections;
            const avgProcessingTime = this.data.reduce((sum, item) => sum + item.processingTime.total, 0) / totalDetections;

            return {
                totalDetections,
                vehicleCount,
                plateCount,
                overallAverageAccuracy: Math.round(totalAccuracy), // Changed name to reflect it's an average
                avgProcessingTime: avgProcessingTime.toFixed(2)
            };
        }

        getDetailedStats() {
            if (!this.data.length) return {};

            const vehicleDetectionAccuracy = this.data.filter(item => item.accuracy.vehicleMatch).length / this.data.length * 100;
            const plateDetectionAccuracy = this.data.filter(item => item.accuracy.plateClassMatch).length / this.data.length * 100;
            
            // Use character-level accuracy for OCR (overall accuracy)
            const totalCharAccuracy = this.data.reduce((sum, item) => {
                return sum + (item.accuracy.plateNumberCharAccuracy || 0);
            }, 0);
            const plateOcrAccuracy = totalCharAccuracy / this.data.length;

            const avgVehicleSpeed = this.data.reduce((sum, item) => sum + item.processingTime.vehicle, 0) / this.data.length;
            const avgPlateDetectionSpeed = this.data.reduce((sum, item) => sum + item.processingTime.plateDetection, 0) / this.data.length;
            const avgPlateOcrSpeed = this.data.reduce((sum, item) => sum + item.processingTime.plateRecognition, 0) / this.data.length;

            return {
                vehicleDetection: {
                    accuracy: Math.round(vehicleDetectionAccuracy) + '%',
                    count: this.data.length,
                    speed: avgVehicleSpeed.toFixed(3) + 's',
                    trend: { arrow: '↗', value: '+2.3%' }
                },
                plateDetection: {
                    accuracy: Math.round(plateDetectionAccuracy) + '%',
                    count: this.data.length,
                    speed: avgPlateDetectionSpeed.toFixed(3) + 's',
                    trend: { arrow: '↗', value: '+1.8%' }
                },
                plateOCR: {
                    accuracy: Math.round(plateOcrAccuracy) + '%', // Using overall char matching accuracy
                    count: this.data.filter(item => item.predictions.plateNumber && item.predictions.plateNumber.trim()).length,
                    speed: avgPlateOcrSpeed.toFixed(3) + 's',
                    trend: { arrow: '↘', value: '-0.5%' }
                }
            };
        }

        // Calculate test case performance statistics
        calculateTestCaseStats() {
            if (!this.data.length) return {};

            const stats = {};
            
            // Define test case categories and their possible values
            const testCaseCategories = {
                quality: ['good', 'average', 'poor'],
                lighting: ['day', 'lit', 'night'], 
                resolution: ['high', 'medium', 'low'],
                count: ['single', 'multiple', 'crowded'],
                distance: ['near', 'medium', 'far'],
                angle: ['front', 'side', 'topdown']
            };

            // Calculate stats for each category
            Object.keys(testCaseCategories).forEach(category => {
                testCaseCategories[category].forEach(value => {
                    const filteredData = this.getDataForTestCase(category, value);
                    const categoryValue = this.formatTestCaseKey(category, value);
                    
                    stats[categoryValue] = {
                        count: filteredData.length,
                        accuracy: this.calculateAverageAccuracy(filteredData),
                        speed: this.calculateAverageSpeed(filteredData)
                    };
                });
            });

            return stats;
        }

        getDataForTestCase(category, value) {
            const fieldMap = {
                quality: 'test_case_image_quality',
                lighting: 'test_case_image_lighting',
                resolution: 'test_case_image_resolution',
                count: 'test_case_object_count',
                distance: 'test_case_vehicle_distance',
                angle: 'test_case_camera_angle'
            };

            const fieldName = fieldMap[category];
            if (!fieldName) return [];

            return this.data.filter(item => {
                const testCaseValue = item.rawData ? item.rawData[fieldName] : '';
                return testCaseValue && testCaseValue.toLowerCase() === value.toLowerCase();
            });
        }

        formatTestCaseKey(category, value) {
            const categoryMap = {
                quality: 'quality',
                lighting: 'lighting', 
                resolution: 'resolution',
                count: 'count',
                distance: 'distance',
                angle: 'angle'
            };

            const valueMap = {
                topdown: 'Topdown'
            };

            const formattedCategory = categoryMap[category] || category;
            const formattedValue = valueMap[value] || value.charAt(0).toUpperCase() + value.slice(1);
            
            return `${formattedCategory}${formattedValue}`;
        }

        calculateAverageAccuracy(data) {
            if (!data.length) return 0;
            
            const totalAccuracy = data.reduce((sum, item) => sum + item.accuracy.percentage, 0);
            return Math.round(totalAccuracy / data.length);
        }

        calculateAverageSpeed(data) {
            if (!data.length) return 0;
            
            const totalSpeed = data.reduce((sum, item) => sum + item.processingTime.total, 0);
            return (totalSpeed / data.length).toFixed(3);
        }

        // Update test case UI
        updateTestCaseUI() {
            const stats = this.calculateTestCaseStats();

            Object.keys(stats).forEach(testCase => {
                const countElement = document.getElementById(`${testCase}Count`);
                const accuracyElement = document.getElementById(`${testCase}Accuracy`);
                const speedElement = document.getElementById(`${testCase}Speed`);

                if (countElement) {
                    countElement.textContent = `${stats[testCase].count} tests`;
                }
                if (accuracyElement) {
                    accuracyElement.textContent = `${stats[testCase].accuracy}%`;
                }
                if (speedElement) {
                    speedElement.textContent = `${stats[testCase].speed}s`;
                }
            });
        }
    }

    // Enhanced initialization with CSV data loading
    async function loadCSVData() {
        try {
            showLoadingState();
            
            console.log('Attempting to load CSV data...');
            
            // Use built-in CSV loader
            window.csvLoader = new SimpleCSVLoader();
            
            console.log('SimpleCSVLoader initialized, attempting to load CSV...');
            const data = await window.csvLoader.loadCSV();
            console.log('CSV load result:', data);
            
            if (data && data.length > 0) {
                console.log(`Successfully loaded ${data.length} records from CSV`);
                
                // Update dashboard with real data
                updateDashboardWithCSVData();
                showNotification(`Successfully loaded ${data.length} records from CSV`, 'success');
            } else {
                console.log('No data returned from CSV, loading sample data');
                loadSampleData();
                showNotification('CSV file not found or empty. Showing sample data.', 'warning');
            }
        } catch (error) {
            console.error('Error loading CSV data:', error);
            loadSampleData();
            showNotification('Error loading CSV data. Showing sample data.', 'error');
        }
        
        hideLoadingState();
    }

    function updateDashboardWithCSVData() {
        if (window.csvLoader && window.csvLoader.isLoaded) {
            const summaryStats = window.csvLoader.getSummaryStats();
            updateStatistics(summaryStats);
            
            const detailedStats = window.csvLoader.getDetailedStats();
            updateDetailedStatistics(detailedStats);
            
            // Update test case performance statistics
            window.csvLoader.updateTestCaseUI();
            
            // Render CSV data in table
            renderCSVDataInTable();
        }
    }

    function renderCSVDataInTable() {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody || !window.csvLoader || !window.csvLoader.data) return;
        
        // Store all data globally for pagination and filtering
        window.allData = window.csvLoader.data;
        window.filteredData = [...window.allData]; // Initialize filtered data
        
        // Render current page
        renderCurrentPage();
        updatePaginationControls();
        updateResultsCount();
    }

    function showLoadingState() {
        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="data-loading">
                        Loading CSV data...
                    </td>
                </tr>
            `;
        }
    }

    function hideLoadingState() {
        // Loading state will be replaced by data or sample content
    }

    // NEW: Initialize filters
    function initializeFilters() {
        // Add filter controls to the table header
        addFilterControls();
        
        // Set up event listeners for filters
        setupFilterListeners();
    }

    function addFilterControls() {
        const tabContentHeader = document.querySelector('#test-results .tab-content-header');
        if (tabContentHeader) {
            const filterDiv = document.createElement('div');
            filterDiv.className = 'data-filters';
            filterDiv.innerHTML = `
                <div class="filter-row">
                    <input type="text" id="searchFilter" class="filter-input" placeholder="Search by filename, vehicle, plate number...">
                    <select id="testCaseFilter" class="filter-select">
                        <option value="">All Test Cases</option>
                        <option value="quality-good">Quality: Good</option>
                        <option value="quality-average">Quality: Average</option>
                        <option value="quality-poor">Quality: Poor</option>
                        <option value="lighting-day">Lighting: Day</option>
                        <option value="lighting-lit">Lighting: Lit</option>
                        <option value="lighting-night">Lighting: Night</option>
                        <option value="resolution-high">Resolution: High</option>
                        <option value="resolution-medium">Resolution: Medium</option>
                        <option value="resolution-low">Resolution: Low</option>
                        <option value="count-single">Count: Single</option>
                        <option value="count-multiple">Count: Multiple</option>
                        <option value="count-crowded">Count: Crowded</option>
                        <option value="distance-near">Distance: Near</option>
                        <option value="distance-medium">Distance: Medium</option>
                        <option value="distance-far">Distance: Far</option>
                        <option value="angle-front">Angle: Front</option>
                        <option value="angle-side">Angle: Side</option>
                        <option value="angle-topdown">Angle: Top-down</option>
                    </select>
                    <select id="accuracyFilter" class="filter-select">
                        <option value="">All Accuracy Levels</option>
                        <option value="high">High (80-100%)</option>
                        <option value="medium">Medium (50-79%)</option>
                        <option value="low">Low (0-49%)</option>
                    </select>
                    <select id="processingTimeFilter" class="filter-select">
                        <option value="">All Processing Times</option>
                        <option value="fast">Fast (1-5s)</option>
                        <option value="medium">Medium (6-10s)</option>
                        <option value="slow">Slow (10s+)</option>
                    </select>
                    <button id="clearFilters" class="btn btn-sm btn-secondary">Clear Filters</button>
                </div>
            `;
            
            tabContentHeader.appendChild(filterDiv);
        }
    }

    function setupFilterListeners() {
        const searchFilter = document.getElementById('searchFilter');
        const testCaseFilter = document.getElementById('testCaseFilter');
        const accuracyFilter = document.getElementById('accuracyFilter');
        const processingTimeFilter = document.getElementById('processingTimeFilter');
        const clearFilters = document.getElementById('clearFilters');

        if (searchFilter) {
            searchFilter.addEventListener('input', applyFilters);
        }
        if (testCaseFilter) {
            testCaseFilter.addEventListener('change', applyFilters);
        }
        if (accuracyFilter) {
            accuracyFilter.addEventListener('change', applyFilters);
        }
        if (processingTimeFilter) {
            processingTimeFilter.addEventListener('change', applyFilters);
        }
        if (clearFilters) {
            clearFilters.addEventListener('click', clearAllFilters);
        }
    }

    function applyFilters() {
        if (!window.allData) return;

        const searchTerm = document.getElementById('searchFilter')?.value.toLowerCase() || '';
        const testCase = document.getElementById('testCaseFilter')?.value || '';
        const accuracyLevel = document.getElementById('accuracyFilter')?.value || '';
        const processingTimeLevel = document.getElementById('processingTimeFilter')?.value || '';

        let filtered = [...window.allData];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(item => 
                (item.filename || '').toLowerCase().includes(searchTerm) ||
                (item.predictions.vehicleClass || '').toLowerCase().includes(searchTerm) ||
                (item.predictions.plateNumber || '').toLowerCase().includes(searchTerm) ||
                (item.actual.vehicleClass || '').toLowerCase().includes(searchTerm) ||
                (item.actual.plateNumber || '').toLowerCase().includes(searchTerm)
            );
        }

        // Apply test case filter
        if (testCase) {
            filtered = filtered.filter(item => 
                item.testCases.some(tc => tc.includes(testCase))
            );
        }

        // Apply accuracy filter
        if (accuracyLevel) {
            filtered = filtered.filter(item => {
                const accuracy = item.accuracy.percentage;
                switch (accuracyLevel) {
                    case 'high': return accuracy >= 80;
                    case 'medium': return accuracy >= 50 && accuracy < 80;
                    case 'low': return accuracy < 50;
                    default: return true;
                }
            });
        }

        // Apply processing time filter
        if (processingTimeLevel) {
            filtered = filtered.filter(item => {
                const processingTime = item.processingTime.total;
                switch (processingTimeLevel) {
                    case 'fast': return processingTime >= 1 && processingTime <= 5;
                    case 'medium': return processingTime > 5 && processingTime <= 10;
                    case 'slow': return processingTime > 10;
                    default: return true;
                }
            });
        }

        window.filteredData = filtered;
        window.currentPage = 1; // Reset to first page
        renderCurrentPage();
        updatePaginationControls();
        updateResultsCount();
    }

    function clearAllFilters() {
        document.getElementById('searchFilter').value = '';
        document.getElementById('testCaseFilter').value = '';
        document.getElementById('accuracyFilter').value = '';
        document.getElementById('processingTimeFilter').value = '';
        
        window.filteredData = [...window.allData];
        window.currentPage = 1;
        renderCurrentPage();
        updatePaginationControls();
        updateResultsCount();
    }

    // Helper function to get color class based on value ranges
    function getAccuracyColorClass(accuracy) {
        if (accuracy >= 80) return 'accuracy-high';
        if (accuracy >= 50) return 'accuracy-medium';
        return 'accuracy-low';
    }

    function getSpeedColorClass(speed) {
        if (speed <= 5) return 'speed-fast';
        if (speed <= 10) return 'speed-medium';
        return 'speed-slow';
    }

    // Tab System
    function initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                this.classList.add('active');
                const targetElement = document.getElementById(targetTab);
                if (targetElement) {
                    targetElement.classList.add('active');
                }
                
                console.log(`Switched to tab: ${targetTab}`);
            });
        });
    }

    // Modal System
    function initializeModal() {
        const modal = document.getElementById('imageModal');
        const modalClose = document.getElementById('modalCloseBtn');

        if (modalClose) {
            modalClose.addEventListener('click', function() {
                if (modal) modal.classList.remove('show');
            });
        }

        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
                modal.classList.remove('show');
            }
        });
    }

    // Global function to open modal
    window.openImageModal = function(imageSrc, caption) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalCaption = document.getElementById('modalCaption');
        
        if (modal && modalImage && modalCaption) {
            modalImage.src = imageSrc;
            modalCaption.textContent = caption || '';
            modal.classList.add('show');
        }
    };

    // Notification System
    function showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.add('hiding');
            setTimeout(() => {
                if (container.contains(notification)) {
                    container.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Global function to toggle row details
    window.toggleRowDetails = function(rowId) {
        const row = document.querySelector(`[data-row-id="${rowId}"]`);
        const detailsRow = document.querySelector(`[data-details-for="${rowId}"]`);
        
        if (!row || !detailsRow) return;
        
        const expandBtn = row.querySelector('.expand-btn');
        const actionBtn = row.querySelector('.toggle-details');
        
        if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
            detailsRow.style.display = 'table-row';
            if (expandBtn) {
                expandBtn.textContent = '▼';
                expandBtn.title = 'Collapse details';
            }
            if (actionBtn) {
                const btnText = actionBtn.querySelector('.btn-text');
                if (btnText) btnText.textContent = 'Close Details';
            }
            row.classList.add('expanded');
        } else {
            detailsRow.style.display = 'none';
            if (expandBtn) {
                expandBtn.textContent = '▶';
                expandBtn.title = 'Expand details';
            }
            if (actionBtn) {
                const btnText = actionBtn.querySelector('.btn-text');
                if (btnText) btnText.textContent = 'Show Details';
            }
            row.classList.remove('expanded');
        }
    };

    // Sample Data Loading (fallback)
    function loadSampleData() {
        updateStatistics({
            totalDetections: 2,
            vehicleCount: 2,
            plateCount: 2,
            overallAverageAccuracy: 85, // Updated name
            avgProcessingTime: 1.67
        });

        updateDetailedStatistics({
            vehicleDetection: { accuracy: '100%', count: '2', speed: '0.34s', trend: { arrow: '↗', value: '+2.3%' } },
            plateDetection: { accuracy: '100%', count: '2', speed: '2.06s', trend: { arrow: '↗', value: '+1.8%' } },
            plateOCR: { accuracy: '50%', count: '2', speed: '6.83s', trend: { arrow: '↘', value: '-0.5%' } }
        });

        initializeTestCasePerformance();
        addSampleResults();
    }

    function addSampleResults() {
        const sampleResults = [
            {
                id: 'result-1',
                testCases: ['quality-good', 'lighting-day', 'resolution-medium'], // Updated to lowercase
                specialCases: [], // No special cases for sample data
                images: [
                    { src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjM2I4MmY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5PcmlnaW5hbDwvdGV4dD48L3N2Zz4=', alt: 'Original Image', label: 'O' },
                    { src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTBiOTgxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EZXRlY3RlZDwvdGV4dD48L3N2Zz4=', alt: 'Detected Image', label: 'D' }
                ],
                croppedImages: {
                    vehicle: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjU5ZTBiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5WZWhpY2xlPC90ZXh0Pjwvc3ZnPg==',
                    plate: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWY0NDQ0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QbGF0ZTwvdGV4dD48L3N2Zz4='
                },
                predictions: { vehicleClass: 'Car', plateClass: 'Plate', plateNumber: 'DN 1732 MK' },
                actual: { vehicleClass: 'Car', plateClass: 'Plate', plateNumber: 'DN 1732 MK' },
                confidence: { vehicle: 0.95, plate: 0.88, ocr: 0.9 },
                accuracy: { percentage: 100, vehicleMatch: true, plateClassMatch: true, plateNumberMatch: true },
                processingTime: { vehicle: 0.82, plateDetection: 0.27, plateRecognition: 2.43, total: 3.52 }
            },
            {
                id: 'result-2',
                testCases: ['quality-average', 'lighting-day', 'resolution-medium'], // Updated to lowercase
                specialCases: ['edge_case'], // Sample special case
                images: [
                    { src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjM2I4MmY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5PcmlnaW5hbDwvdGV4dD48L3N2Zz4=', alt: 'Original Image', label: 'O' },
                    { src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTBiOTgxIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EZXRlY3RlZDwvdGV4dD48L3N2Zz4=', alt: 'Detected Image', label: 'D' }
                ],
                croppedImages: {
                    vehicle: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjU5ZTBiIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5WZWhpY2xlPC90ZXh0Pjwvc3ZnPg==',
                    plate: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWY0NDQ0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QbGF0ZTwvdGV4dD48L3N2Zz4='
                },
                predictions: { vehicleClass: 'Motorcycle', plateClass: 'Plate', plateNumber: 'BM 4173 SZ' },
                actual: { vehicleClass: 'Motorcycle', plateClass: 'Plate', plateNumber: 'DK 4173 SZ' },
                confidence: { vehicle: 0.89, plate: 0.87, ocr: 0.9 },
                accuracy: { percentage: 67, vehicleMatch: true, plateClassMatch: true, plateNumberMatch: false },
                processingTime: { vehicle: 0.27, plateDetection: 0.25, plateRecognition: 1.89, total: 2.41 }
            }
        ];

        const tableBody = document.getElementById('resultsTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            sampleResults.forEach(result => addOptimizedResultRow(result));
            
            // Set up pagination for sample data
            window.allData = sampleResults;
            window.filteredData = [...sampleResults];
            window.currentPage = 1;
            renderCurrentPage();
            updatePaginationControls();
            updateResultsCount();
        }
    }

    function addOptimizedResultRow(resultData) {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) return;
        
        const timestamp = resultData.timestamp || formatTimestamp(new Date());
        const imageCarousel = createImageCarousel(resultData.images);
        
        // Get color classes for styling
        const accuracyClass = getAccuracyColorClass(resultData.accuracy.percentage);
        const speedClass = getSpeedColorClass(resultData.processingTime.total);
        
        // Main row
        const mainRow = document.createElement('tr');
        mainRow.className = 'main-row';
        mainRow.setAttribute('data-row-id', resultData.id);
        
        mainRow.innerHTML = `
            <td class="table-cell-large">
                <button class="expand-btn expand-btn-large" onclick="toggleRowDetails('${resultData.id}')" title="Expand details">▶</button>
            </td>
            <td class="table-cell-large">
                <div class="timestamp-display timestamp-display-large">
                    <div class="timestamp-date">${timestamp.date || timestamp}</div>
                    <div class="timestamp-time">${timestamp.time || ''}</div>
                </div>
            </td>
            <td class="table-cell-large">
                <div class="test-cases-compact">
                    ${resultData.testCases.map(tc => `<span class="tag tag-large">${tc.toLowerCase()}</span>`).join('')}
                    ${resultData.specialCases ? resultData.specialCases.map(sc => `<span class="tag tag-large tag-special-case">${sc}</span>`).join('') : ''}
                </div>
            </td>
            <td class="table-cell-large">
                <div class="images-preview images-preview-large">
                    ${imageCarousel}
                </div>
            </td>
            <td class="accuracy-cell table-cell-large">
                <span class="${accuracyClass} accuracy-large">
                    ${resultData.accuracy.percentage}%
                </span>
            </td>
            <td class="processing-time table-cell-large">
                <span class="${speedClass} processing-time-large">${resultData.processingTime.total.toFixed(2)}s</span>
            </td>
            <td class="table-cell-large">
                <div class="action-buttons-compact">
                    <button class="btn btn-sm btn-primary toggle-details btn-large" onclick="toggleRowDetails('${resultData.id}')">
                        <span class="btn-text">Show Details</span>
                    </button>
                </div>
            </td>
        `;
        
        // Details row with processing time and confidence for each section
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'details-row';
        detailsRow.setAttribute('data-details-for', resultData.id);
        detailsRow.style.display = 'none';
        
        detailsRow.innerHTML = `
            <td colspan="7">
                <div class="row-details">
                    <div class="details-section">
                        <h4>🚗 Vehicle Detection</h4>
                        <div class="detection-card">
                            <div class="cropped-image-container">
                                <img src="${resultData.croppedImages.vehicle}" alt="Cropped Vehicle" class="cropped-image" 
                                     onclick="openImageModal('${resultData.croppedImages.vehicle}', 'Cropped Vehicle Image')">
                                <div class="image-label">Cropped Vehicle</div>
                            </div>
                            <div class="comparison-container ${resultData.accuracy.vehicleMatch ? 'match' : 'mismatch'}">
                                <div class="comparison-item">
                                    <div class="comparison-label">Predicted</div>
                                    <div class="predicted-value">${resultData.predictions.vehicleClass}</div>
                                    <div class="confidence-score">Accuracy: ${(resultData.accuracy.vehicleAccuracy || (resultData.accuracy.vehicleMatch ? 100 : 0))}%</div>
                                </div>
                                <div class="vs-separator">${resultData.accuracy.vehicleMatch ? '✓' : '✗'}</div>
                                <div class="comparison-item">
                                    <div class="comparison-label">Actual</div>
                                    <div class="actual-value">${resultData.actual.vehicleClass}</div>
                                    <div class="processing-time-info">Time: ${resultData.processingTime.vehicle.toFixed(3)}s</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="details-section">
                        <h4>🏷️ Plate Detection</h4>
                        <div class="detection-card">
                            <div class="cropped-image-container">
                                <img src="${resultData.croppedImages.plate}" alt="Cropped Plate" class="cropped-image" 
                                     onclick="openImageModal('${resultData.croppedImages.plate}', 'Cropped Plate Image')">
                                <div class="image-label">Cropped Plate</div>
                            </div>
                            <div class="comparison-container ${resultData.accuracy.plateClassMatch ? 'match' : 'mismatch'}">
                                <div class="comparison-item">
                                    <div class="comparison-label">Predicted</div>
                                    <div class="predicted-value">${resultData.predictions.plateClass}</div>
                                    <div class="confidence-score">Accuracy: ${(resultData.accuracy.plateDetectionAccuracy || (resultData.accuracy.plateClassMatch ? 100 : 0))}%</div>
                                </div>
                                <div class="vs-separator">${resultData.accuracy.plateClassMatch ? '✓' : '✗'}</div>
                                <div class="comparison-item">
                                    <div class="comparison-label">Actual</div>
                                    <div class="actual-value">${resultData.actual.plateClass}</div>
                                    <div class="processing-time-info">Time: ${resultData.processingTime.plateDetection.toFixed(3)}s</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="details-section">
                        <h4>🔤 Plate OCR</h4>
                        <div class="detection-card">
                            <div class="cropped-image-container">
                                <img src="${resultData.croppedImages.plate}" alt="Plate for OCR" class="cropped-image" 
                                     onclick="openImageModal('${resultData.croppedImages.plate}', 'Plate Image for OCR')">
                                <div class="image-label">Plate for OCR</div>
                            </div>
                            <div class="comparison-container ${resultData.accuracy.plateNumberMatch ? 'match' : 'mismatch'}">
                                <div class="comparison-item">
                                    <div class="comparison-label">Predicted</div>
                                    <div class="predicted-value">${resultData.predictions.plateNumber}</div>
                                    <div class="confidence-score">Accuracy: ${(resultData.accuracy.plateNumberCharAccuracy || 0)}%</div>
                                </div>
                                <div class="vs-separator">${resultData.accuracy.plateNumberMatch ? '✓' : '✗'}</div>
                                <div class="comparison-item">
                                    <div class="comparison-label">Actual</div>
                                    <div class="actual-value">${resultData.actual.plateNumber}</div>
                                    <div class="processing-time-info">Time: ${resultData.processingTime.plateRecognition.toFixed(3)}s</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="details-actions">
                        <button class="btn btn-secondary" onclick="toggleRowDetails('${resultData.id}')">Close Details</button>
                    </div>
                </div>
            </td>
        `;
        
        tableBody.appendChild(mainRow);
        tableBody.appendChild(detailsRow);
    }

    function createImageCarousel(images) {
        const carouselId = `carousel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="image-carousel" id="${carouselId}">
                <div class="carousel-container">
                    <button class="carousel-btn prev" onclick="changeCarouselImage('${carouselId}', -1)">&lt;</button>
                    <img class="carousel-image" 
                         src="${images[0].src}" 
                         alt="${images[0].alt}" 
                         data-current-index="0"
                         data-images='${JSON.stringify(images).replace(/'/g, "&apos;")}'>
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

    // Carousel functions
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

    // Update functions
    function updateStatistics(stats) {
        const elements = {
            totalDetections: document.getElementById('totalDetections'),
            vehicleCount: document.getElementById('vehicleCount'),
            plateCount: document.getElementById('plateCount'),
            overallAccuracy: document.getElementById('overallAccuracy'),
            avgProcessingTime: document.getElementById('avgProcessingTime')
        };
        
        if (elements.totalDetections) elements.totalDetections.textContent = stats.totalDetections;
        if (elements.vehicleCount) elements.vehicleCount.textContent = stats.vehicleCount;
        if (elements.plateCount) elements.plateCount.textContent = stats.plateCount;
        if (elements.overallAccuracy) elements.overallAccuracy.textContent = (stats.overallAverageAccuracy || stats.overallAccuracy) + '%';
        if (elements.avgProcessingTime) elements.avgProcessingTime.textContent = stats.avgProcessingTime + 's';
    }

    function updateDetailedStatistics(stats) {
        // Update vehicle detection stats
        const vehicleElements = {
            accuracy: document.getElementById('vehicleDetectionAccuracy'),
            count: document.getElementById('vehicleDetectionCount'),
            speed: document.getElementById('vehicleDetectionSpeed'),
            trend: document.getElementById('vehicleDetectionTrend')
        };
        
        if (vehicleElements.accuracy) vehicleElements.accuracy.textContent = stats.vehicleDetection.accuracy;
        if (vehicleElements.count) vehicleElements.count.textContent = stats.vehicleDetection.count;
        if (vehicleElements.speed) vehicleElements.speed.textContent = stats.vehicleDetection.speed;
        
        if (vehicleElements.trend) {
            const arrow = vehicleElements.trend.querySelector('.trend-arrow');
            const value = vehicleElements.trend.querySelector('.trend-value');
            if (arrow) arrow.textContent = stats.vehicleDetection.trend.arrow;
            if (value) value.textContent = stats.vehicleDetection.trend.value;
        }

        // Update plate detection stats
        const plateElements = {
            accuracy: document.getElementById('plateDetectionAccuracy'),
            count: document.getElementById('plateDetectionCount'),
            speed: document.getElementById('plateDetectionSpeed'),
            trend: document.getElementById('plateDetectionTrend')
        };
        
        if (plateElements.accuracy) plateElements.accuracy.textContent = stats.plateDetection.accuracy;
        if (plateElements.count) plateElements.count.textContent = stats.plateDetection.count;
        if (plateElements.speed) plateElements.speed.textContent = stats.plateDetection.speed;
        
        if (plateElements.trend) {
            const arrow = plateElements.trend.querySelector('.trend-arrow');
            const value = plateElements.trend.querySelector('.trend-value');
            if (arrow) arrow.textContent = stats.plateDetection.trend.arrow;
            if (value) value.textContent = stats.plateDetection.trend.value;
        }

        // Update OCR stats
        const ocrElements = {
            accuracy: document.getElementById('plateOcrAccuracy'),
            count: document.getElementById('plateOcrCount'),
            speed: document.getElementById('plateOcrSpeed'),
            trend: document.getElementById('plateOcrTrend')
        };
        
        if (ocrElements.accuracy) ocrElements.accuracy.textContent = stats.plateOCR.accuracy;
        if (ocrElements.count) ocrElements.count.textContent = stats.plateOCR.count;
        if (ocrElements.speed) ocrElements.speed.textContent = stats.plateOCR.speed;
        
        if (ocrElements.trend) {
            const arrow = ocrElements.trend.querySelector('.trend-arrow');
            const value = ocrElements.trend.querySelector('.trend-value');
            if (arrow) arrow.textContent = stats.plateOCR.trend.arrow;
            if (value) value.textContent = stats.plateOCR.trend.value;
        }
    }

    function initializeTestCasePerformance() {
        const testCases = [
            'qualityGood', 'qualityAverage', 'qualityPoor',
            'lightingDay', 'lightingLit', 'lightingNight',
            'resolutionHigh', 'resolutionMedium', 'resolutionLow',
            'countSingle', 'countMultiple', 'countCrowded',
            'distanceNear', 'distanceMedium', 'distanceFar',
            'angleFront', 'angleSide', 'angleTopdown'
        ];

        testCases.forEach(testCase => {
            const countElement = document.getElementById(`${testCase}Count`);
            const accuracyElement = document.getElementById(`${testCase}Accuracy`);
            const speedElement = document.getElementById(`${testCase}Speed`);

            if (countElement) countElement.textContent = '- tests';
            if (accuracyElement) accuracyElement.textContent = '-%';
            if (speedElement) speedElement.textContent = '-s';
        });
    }

    function updateResultsCount() {
        const resultsCount = document.getElementById('resultsCount');
        
        if (resultsCount && window.filteredData) {
            const totalCount = window.filteredData.length;
            const startItem = (window.currentPage - 1) * window.itemsPerPage + 1;
            const endItem = Math.min(window.currentPage * window.itemsPerPage, totalCount);
            
            resultsCount.textContent = `${startItem}-${endItem} of ${totalCount} results`;
        }
    }

    // Pagination functions (updated to use filteredData)
    function renderCurrentPage() {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody || !window.filteredData) return;
        
        tableBody.innerHTML = '';
        
        const startIndex = (window.currentPage - 1) * window.itemsPerPage;
        const endIndex = startIndex + window.itemsPerPage;
        const currentPageData = window.filteredData.slice(startIndex, endIndex);
        
        currentPageData.forEach(result => {
            addOptimizedResultRow(result);
        });
    }

    function updatePaginationControls() {
        // Remove existing pagination controls
        const existingPagination = document.querySelector('.pagination-controls');
        if (existingPagination) {
            existingPagination.remove();
        }
        
        if (!window.filteredData || window.filteredData.length <= window.itemsPerPage) {
            return; // No pagination needed
        }
        
        const totalPages = Math.ceil(window.filteredData.length / window.itemsPerPage);
        const tableContainer = document.querySelector('.table-container');
        
        if (tableContainer) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls';
            paginationDiv.innerHTML = `
                <div class="pagination-info">
                    Page ${window.currentPage} of ${totalPages}
                </div>
                <div class="pagination-buttons">
                    <button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(1)" ${window.currentPage === 1 ? 'disabled' : ''}>
                        First
                    </button>
                    <button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(${window.currentPage - 1})" ${window.currentPage === 1 ? 'disabled' : ''}>
                        Previous
                    </button>
                    <span class="pagination-pages">
                        ${generatePageNumbers(window.currentPage, totalPages)}
                    </span>
                    <button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(${window.currentPage + 1})" ${window.currentPage === totalPages ? 'disabled' : ''}>
                        Next
                    </button>
                    <button class="btn btn-sm btn-secondary pagination-btn" onclick="goToPage(${totalPages})" ${window.currentPage === totalPages ? 'disabled' : ''}>
                        Last
                    </button>
                </div>
            `;
            
            tableContainer.appendChild(paginationDiv);
        }
    }

    function generatePageNumbers(currentPage, totalPages) {
        let pages = '';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            pages += `<button class="btn btn-sm pagination-page ${isActive}" onclick="goToPage(${i})">${i}</button>`;
        }
        
        return pages;
    }

    // Global pagination functions (updated to use filteredData)
    window.goToPage = function(page) {
        if (!window.filteredData) return;
        
        const totalPages = Math.ceil(window.filteredData.length / window.itemsPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        window.currentPage = page;
        renderCurrentPage();
        updatePaginationControls();
        updateResultsCount();
        
        // Scroll to top of table
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    function formatTimestamp(date) {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        
        const formatted = date.toLocaleDateString('en-US', options);
        const [datePart, timePart] = formatted.split(', ');
        
        return { date: datePart, time: timePart };
    }

    // Image click handler for modal
    document.addEventListener('click', function(e) {
        if (e.target.matches('.carousel-image, .cropped-image')) {
            const img = e.target;
            const caption = img.alt || 'Image Preview';
            openImageModal(img.src, caption);
        }
    });

    // Test CSV loading directly
    window.testCSVLoad = async function() {
        try {
            console.log('Testing direct CSV load...');
            const response = await fetch('galaxy_alpr_performance.csv');
            console.log('Fetch response:', response);
            
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return;
            }
            
            const csvText = await response.text();
            console.log('CSV content length:', csvText.length);
            console.log('First 500 chars:', csvText.substring(0, 500));
            
            const lines = csvText.trim().split('\n');
            console.log('Number of lines:', lines.length);
            console.log('Header line:', lines[0]);
            
            if (lines.length > 1) {
                console.log('First data line:', lines[1]);
            }
            
        } catch (error) {
            console.error('Direct CSV test failed:', error);
        }
    };

    // Global exports
    window.GalaxyALPR = {
        showNotification,
        updateStatistics,
        updateDetailedStatistics,
        toggleRowDetails,
        openImageModal,
        loadCSVData,
        testCSVLoad,
        applyFilters,
        clearAllFilters
    };

    console.log('Galaxy ALPR Dashboard initialized - Fixed OCR comparison and added filters with color adjustments');
}