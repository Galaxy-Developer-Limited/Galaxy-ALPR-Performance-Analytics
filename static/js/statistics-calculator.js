// statistics-calculator.js - Performance Statistics Calculator with Color Updates
class StatisticsCalculator {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    // Helper function to get accuracy level
    getAccuracyLevel(accuracy) {
        if (accuracy >= 80) return 'high';
        if (accuracy >= 50) return 'medium';
        return 'low';
    }

    // Helper function to get speed level
    getSpeedLevel(speed) {
        if (speed <= 5) return 'fast';
        if (speed <= 10) return 'medium';
        return 'slow';
    }

    // Calculate test case performance statistics
    calculateTestCasePerformance() {
        if (!this.dataLoader.isLoaded || !this.dataLoader.processedData.length) {
            return this.getEmptyTestCaseStats();
        }

        const data = this.dataLoader.processedData;
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
                const filteredData = this.getDataForTestCase(data, category, value);
                const categoryValue = this.formatTestCaseKey(category, value);
                
                const accuracy = this.calculateAverageAccuracy(filteredData);
                const speed = parseFloat(this.calculateAverageSpeed(filteredData));
                
                stats[categoryValue] = {
                    count: filteredData.length,
                    accuracy: accuracy,
                    speed: speed.toFixed(3),
                    accuracyLevel: this.getAccuracyLevel(accuracy),
                    speedLevel: this.getSpeedLevel(speed)
                };
            });
        });

        return stats;
    }

    getDataForTestCase(data, category, value) {
        const searchTerm = `${category}-${value}`.toLowerCase();
        return data.filter(item => {
            return item.testCases.some(testCase => {
                const normalized = testCase.toLowerCase().replace(/[^a-z0-9-]/g, '');
                return normalized.includes(searchTerm) || 
                       normalized.includes(value.toLowerCase());
            });
        });
    }

    formatTestCaseKey(category, value) {
        // Convert to the format expected by the UI
        const categoryMap = {
            quality: 'quality',
            lighting: 'lighting', 
            resolution: 'resolution',
            count: 'count',
            distance: 'distance',
            angle: 'angle'
        };

        const valueMap = {
            topdown: 'Topdown' // Special case for top-down
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

    getEmptyTestCaseStats() {
        const testCases = [
            'qualityGood', 'qualityAverage', 'qualityPoor',
            'lightingDay', 'lightingLit', 'lightingNight',
            'resolutionHigh', 'resolutionMedium', 'resolutionLow',
            'countSingle', 'countMultiple', 'countCrowded',
            'distanceNear', 'distanceMedium', 'distanceFar',
            'angleFront', 'angleSide', 'angleTopdown'
        ];

        const stats = {};
        testCases.forEach(testCase => {
            stats[testCase] = {
                count: 0,
                accuracy: 0,
                speed: 0,
                accuracyLevel: 'low',
                speedLevel: 'slow'
            };
        });

        return stats;
    }

    // Update the UI with calculated statistics and apply color classes
    updateTestCaseUI() {
        const stats = this.calculateTestCasePerformance();

        Object.keys(stats).forEach(testCase => {
            const countElement = document.getElementById(`${testCase}Count`);
            const accuracyElement = document.getElementById(`${testCase}Accuracy`);
            const speedElement = document.getElementById(`${testCase}Speed`);

            if (countElement) {
                countElement.textContent = `${stats[testCase].count} tests`;
            }
            
            if (accuracyElement) {
                accuracyElement.textContent = `${stats[testCase].accuracy}%`;
                // Apply accuracy color class
                accuracyElement.setAttribute('data-accuracy-level', stats[testCase].accuracyLevel);
                
                // Remove existing color classes
                accuracyElement.classList.remove('accuracy-high', 'accuracy-medium', 'accuracy-low');
                
                // Add appropriate color class
                switch(stats[testCase].accuracyLevel) {
                    case 'high':
                        accuracyElement.classList.add('accuracy-high');
                        break;
                    case 'medium':
                        accuracyElement.classList.add('accuracy-medium');
                        break;
                    case 'low':
                        accuracyElement.classList.add('accuracy-low');
                        break;
                }
            }
            
            if (speedElement) {
                speedElement.textContent = `${stats[testCase].speed}s`;
                // Apply speed color class
                speedElement.setAttribute('data-speed-level', stats[testCase].speedLevel);
                
                // Remove existing color classes
                speedElement.classList.remove('speed-fast', 'speed-medium', 'speed-slow');
                
                // Add appropriate color class
                switch(stats[testCase].speedLevel) {
                    case 'fast':
                        speedElement.classList.add('speed-fast');
                        break;
                    case 'medium':
                        speedElement.classList.add('speed-medium');
                        break;
                    case 'slow':
                        speedElement.classList.add('speed-slow');
                        break;
                }
            }
        });
    }

    // Update main statistics cards with color coding
    updateMainStatistics(summaryStats, detailedStats) {
        // Update overall accuracy with color
        const overallAccuracyElement = document.getElementById('overallAccuracy');
        if (overallAccuracyElement && summaryStats) {
            const accuracy = summaryStats.overallAverageAccuracy || summaryStats.overallAccuracy;
            overallAccuracyElement.textContent = accuracy + '%';
            
            // Apply color class to parent stat card
            const statCard = overallAccuracyElement.closest('.stat-card');
            if (statCard) {
                statCard.classList.remove('accuracy-high', 'accuracy-medium', 'accuracy-low');
                const level = this.getAccuracyLevel(accuracy);
                statCard.classList.add(`accuracy-${level}`);
            }
        }

        // Update processing time with color
        const avgProcessingTimeElement = document.getElementById('avgProcessingTime');
        if (avgProcessingTimeElement && summaryStats) {
            const speed = parseFloat(summaryStats.avgProcessingTime);
            avgProcessingTimeElement.textContent = summaryStats.avgProcessingTime + 's';
            
            // Apply color class to parent stat card
            const statCard = avgProcessingTimeElement.closest('.stat-card');
            if (statCard) {
                statCard.classList.remove('speed-fast', 'speed-medium', 'speed-slow');
                const level = this.getSpeedLevel(speed);
                statCard.classList.add(`speed-${level}`);
            }
        }

        // Update detailed statistics with colors
        if (detailedStats) {
            this.updateDetailedStatisticsColors(detailedStats);
        }
    }

    updateDetailedStatisticsColors(stats) {
        // Vehicle detection accuracy
        const vehicleAccuracyElement = document.getElementById('vehicleDetectionAccuracy');
        if (vehicleAccuracyElement && stats.vehicleDetection) {
            const accuracy = parseInt(stats.vehicleDetection.accuracy);
            const level = this.getAccuracyLevel(accuracy);
            vehicleAccuracyElement.setAttribute('data-accuracy-level', level);
        }

        // Vehicle detection speed
        const vehicleSpeedElement = document.getElementById('vehicleDetectionSpeed');
        if (vehicleSpeedElement && stats.vehicleDetection) {
            const speed = parseFloat(stats.vehicleDetection.speed);
            const level = this.getSpeedLevel(speed);
            vehicleSpeedElement.setAttribute('data-speed-level', level);
        }

        // Plate detection accuracy
        const plateAccuracyElement = document.getElementById('plateDetectionAccuracy');
        if (plateAccuracyElement && stats.plateDetection) {
            const accuracy = parseInt(stats.plateDetection.accuracy);
            const level = this.getAccuracyLevel(accuracy);
            plateAccuracyElement.setAttribute('data-accuracy-level', level);
        }

        // Plate detection speed
        const plateSpeedElement = document.getElementById('plateDetectionSpeed');
        if (plateSpeedElement && stats.plateDetection) {
            const speed = parseFloat(stats.plateDetection.speed);
            const level = this.getSpeedLevel(speed);
            plateSpeedElement.setAttribute('data-speed-level', level);
        }

        // OCR accuracy
        const ocrAccuracyElement = document.getElementById('plateOcrAccuracy');
        if (ocrAccuracyElement && stats.plateOCR) {
            const accuracy = parseInt(stats.plateOCR.accuracy);
            const level = this.getAccuracyLevel(accuracy);
            ocrAccuracyElement.setAttribute('data-accuracy-level', level);
        }

        // OCR speed
        const ocrSpeedElement = document.getElementById('plateOcrSpeed');
        if (ocrSpeedElement && stats.plateOCR) {
            const speed = parseFloat(stats.plateOCR.speed);
            const level = this.getSpeedLevel(speed);
            ocrSpeedElement.setAttribute('data-speed-level', level);
        }
    }

    // Calculate confidence statistics
    calculateConfidenceStats() {
        if (!this.dataLoader.isLoaded || !this.dataLoader.processedData.length) {
            return {
                vehicle: { avg: 0, min: 0, max: 0 },
                plate: { avg: 0, min: 0, max: 0 },
                ocr: { avg: 0, min: 0, max: 0 }
            };
        }

        const data = this.dataLoader.processedData;
        
        const vehicleConfidences = data.map(item => item.confidence.vehicle).filter(c => c > 0);
        const plateConfidences = data.map(item => item.confidence.plate).filter(c => c > 0);
        const ocrConfidences = data.map(item => item.confidence.ocr).filter(c => c > 0);

        return {
            vehicle: this.calculateConfidenceMetrics(vehicleConfidences),
            plate: this.calculateConfidenceMetrics(plateConfidences),
            ocr: this.calculateConfidenceMetrics(ocrConfidences)
        };
    }

    calculateConfidenceMetrics(confidences) {
        if (!confidences.length) {
            return { avg: 0, min: 0, max: 0 };
        }

        const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        const min = Math.min(...confidences);
        const max = Math.max(...confidences);

        return {
            avg: (avg * 100).toFixed(1),
            min: (min * 100).toFixed(1),
            max: (max * 100).toFixed(1)
        };
    }

    // Generate performance insights
    generateInsights() {
        if (!this.dataLoader.isLoaded || !this.dataLoader.processedData.length) {
            return [];
        }

        const insights = [];
        const stats = this.calculateTestCasePerformance();
        const data = this.dataLoader.processedData;

        // Find best and worst performing test cases
        const testCaseAccuracies = Object.keys(stats).map(key => ({
            name: key,
            accuracy: stats[key].accuracy,
            count: stats[key].count
        })).filter(item => item.count > 0);

        if (testCaseAccuracies.length > 0) {
            const bestCase = testCaseAccuracies.reduce((best, current) => 
                current.accuracy > best.accuracy ? current : best);
            const worstCase = testCaseAccuracies.reduce((worst, current) => 
                current.accuracy < worst.accuracy ? current : worst);

            insights.push({
                type: 'success',
                title: 'Best Performance',
                message: `${bestCase.name} achieved ${bestCase.accuracy}% accuracy across ${bestCase.count} tests`
            });

            insights.push({
                type: 'warning',
                title: 'Needs Improvement', 
                message: `${worstCase.name} achieved only ${worstCase.accuracy}% accuracy across ${worstCase.count} tests`
            });
        }

        // Processing time insights with new color scheme
        const avgTotalTime = data.reduce((sum, item) => sum + item.processingTime.total, 0) / data.length;
        const slowProcesses = data.filter(item => item.processingTime.total > 10); // Using new 10s threshold

        if (slowProcesses.length > 0) {
            insights.push({
                type: 'error',
                title: 'Slow Processing Detected',
                message: `${slowProcesses.length} detections took longer than 10 seconds (average: ${avgTotalTime.toFixed(2)}s)`
            });
        } else if (avgTotalTime > 5) {
            insights.push({
                type: 'warning',
                title: 'Processing Time Warning',
                message: `Average processing time (${avgTotalTime.toFixed(2)}s) is above optimal range (1-5s)`
            });
        } else {
            insights.push({
                type: 'success',
                title: 'Good Processing Speed',
                message: `Average processing time (${avgTotalTime.toFixed(2)}s) is within optimal range`
            });
        }

        return insights;
    }

    // Export statistics to console for debugging
    exportStats() {
        const stats = {
            summary: this.dataLoader.getSummaryStats(),
            detailed: this.dataLoader.getDetailedStats(),
            testCases: this.calculateTestCasePerformance(),
            confidence: this.calculateConfidenceStats(),
            insights: this.generateInsights()
        };

        console.log('Performance Statistics:', stats);
        return stats;
    }
}

// Create global instance (will be initialized after data is loaded)
window.statisticsCalculator = null;