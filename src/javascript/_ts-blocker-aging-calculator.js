Ext.define('AgingCalculator',{
    singleton: true,  
    getFieldHash: function(snapsForOid, arrayOfFields){
        var fieldHash = {};
        Ext.each(snapsForOid, function(snap){
            Ext.each(arrayOfFields, function(f){
                var snapVal = snap[f];
                var currentVal = fieldHash[f] || '';
                fieldHash[f] = snapVal;
            });
        });
        return fieldHash;
    },
    getFieldCurrentValue: function(snapsForOid, field){
        return snapsForOid[snapsForOid.length-1][field];
    },
    calculateMobility: function(snapsForOid, previousValueField, currentField, fieldValue, mobilityField){
        var startValue = null;
        var currentValue = null; 
        if (snapsForOid.length > 0) {            
            var previousValue = snapsForOid[0][currentField];
            var previousValueField = "_PreviousValues." + currentField;
            if (snapsForOid[0][previousValueField] != undefined){
                previousValue = snapsForOid[0][previousValueField];
            }

            Ext.each(snapsForOid, function(snap){
                if (snap[currentField] != previousValue){
                    if (snap[currentField] === fieldValue){
                        startValue = snap[mobilityField];
                    } 
                } 
                previousValue = snap[currentField];
            },this);
            
            currentValue = snapsForOid[snapsForOid.length-1][mobilityField];
        }
        return {startValue: startValue, currentValue: currentValue}
    },
    calculateDurations: function(snapsForOid, currentField, fieldValue){
        var granularity = "second";
        var conversionDivisor = 86400;
        var ages = [];
        var earliestStartDate = null;  
        var lastEndDate = null; 
       
        if (snapsForOid.length > 0) {
            var startDate = null;
            var endDate = Rally.util.DateTime.fromIsoString(snapsForOid[0]._ValidFrom);
            
            var previousValue = snapsForOid[0][currentField];
            var previousValueField = "_PreviousValues." + currentField;
            if (snapsForOid[0][previousValueField] != undefined){
                previousValue = snapsForOid[0][previousValueField];
            }

            Ext.each(snapsForOid, function(snap){
                if (snap[currentField] != previousValue){
                    var date = Rally.util.DateTime.fromIsoString(snap._ValidFrom);
                    if (snap[currentField] === fieldValue){
                            startDate = date;
                            if (earliestStartDate == null){
                                earliestStartDate = date; 
                            }
                    } 
                    if (startDate && previousValue === fieldValue){
                        lastEndDate = date;
                        ages.push(Rally.util.DateTime.getDifference(date, startDate,granularity)/conversionDivisor);
                        startDate = null;  
                    }
                } 
                previousValue = snap[currentField];
            },this);
            if (startDate != null){
                ages.push(Rally.util.DateTime.getDifference(new Date(),startDate,granularity)/conversionDivisor);
            }
        }
        return {durations: ages, earliestStartDate: earliestStartDate, lastEndDate: lastEndDate};
    }
    
});