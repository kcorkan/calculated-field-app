Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype: 'container', itemId: 'header_box', layout: {type:'hbox'}, items: [
              {xtype:'container',itemId:'control_box',layout:{type:'hbox'}},
              {xtype:'container',itemId:'button_box',layout:{type:'hbox'}},
         ]},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    invalidDateString: 'Invalid Date',
    dateFormat: 'MM/dd/YYYY',
    showOptionsStore: [[true, "Current Blocked Items"],[false, "Items Blocked on or after"]],
    lookbackFetchFields: ['_PreviousValues.Blocked','_SnapshotNumber','Name','FormattedID','_ProjectHierarchy','Feature','_TypeHierarchy','Blocked','_ValidFrom','_ValidTo','BlockedReason','c_BlockerOwnerFirstLast','c_BlockerCategory','c_BlockerCreationDate','DirectChildrenCount','Feature','Iteration'],
    featureHash: {},
    launch: function() {
//    	this.down('#control_box').add({
//    	    xtype: 'rallycombobox',
//    	    itemId: 'cb-option',
//    	    fieldLabel: 'Show Artifacts',
//    	    labelAlign: 'right',
//    	    width: 275,
//    	    margin: 10,
//    	    store: this.showOptionsStore,
//    	    listeners: {
//    	        scope: this,
//    	        change: this._showDatePicker
//    	    }
//    	});

        this.down('#control_box').add({
            xtype: 'rallycheckboxfield',
            itemId: 'chk-blocked',
            fieldLabel: 'Blocked Only',
            labelAlign: 'right',
            labelWidth: 100,
            margin: 10,
            value: true 
        });

        this.down('#control_box').add({
            xtype: 'rallydatefield',
            itemId: 'from-date-picker',
            fieldLabel: 'Items blocked on or after',
            labelAlign: 'right',
            labelWidth: 150,
            margin: 10,
         });

    	this.down('#button_box').add({
    		xtype: 'rallybutton',
    		itemId: 'run-button',
    		text: 'Run',
            margin: 10,
    		scope:this,
    		handler: this._run,
    		//disabled: true
    	});
    	this.down('#button_box').add({
    		xtype: 'rallybutton',
    		itemId: 'export-button',
    		text: 'Export',
            margin: 10,
    		scope: this,
    		handler: this._exportData,
    		//disabled: true
    	});
    },
    _showDatePicker: function(cb){
        if (cb.getValue() === true){
            if(this._getFromDateControl()){
                this._getFromDateControl().destroy();
            }
        } else {
            this.down('#control_box').add({
               xtype: 'rallydatefield',
               itemId: 'from-date-picker',
               margin: 10,
            });
        }
    },
    _getFromDateControl: function(){
        return this.down('#from-date-picker');
    },
    _getFromDate: function(){
        if (this._getFromDateControl()){
            var fromDate = this._getFromDateControl().getValue();
            if (!isNaN(Date.parse(fromDate))){
                return fromDate;
            }
        }
        return null;
    },
    _showOnlyBlockedItems: function(){
        if (this.down('#chk-blocked')){
            return this.down('#chk-blocked').getValue();
        }
        return false;  
    },
    _run: function(){
        
        var fromDate = this._getFromDate();
        if (isNaN(Date.parse(fromDate))){
            Rally.ui.notify.Notifier.showWarning({message: "No date selected.  Please select a date and try again."});
            return;
        }
        
        var current_project_id  = this.getContext().getProject().ObjectID;
        
        this.setLoading(true);
    	this._fetchLookbackStore(current_project_id, fromDate).then({
    	    scope: this,
    	    success: this._calculateAgingForBlockers
    	});
    },
    _fetchLookbackStore: function(currentProjectId, fromDate){
        var deferred = Ext.create('Deft.Deferred');
        
        var find = {};  
        var isoFromDate = Rally.util.DateTime.toIsoString(fromDate);
        find["_ValidTo"] = {$gte: isoFromDate};
        find["$or"] = [{"_PreviousValues.Blocked":true},{"Blocked": true}];
        find["_TypeHierarchy"] = 'HierarchicalRequirement';
        find["_ProjectHierarchy"] = currentProjectId;  
        
    	Ext.create('Rally.data.lookback.SnapshotStore', {
            scope: this,
            listeners: {
                scope: this,
                load: function(store, data, success){
                    this.logger.log('fetchLookbackStore load',data.length, success);
                    var snaps_by_oid = Rally.technicalservices.Toolbox.aggregateSnapsByOidForModel(data);
                    deferred.resolve(snaps_by_oid);
                }
            },
            autoLoad: true,
            fetch: this.lookbackFetchFields, 
            hydrate: ["Iteration","Project"],
            find: find,
            sort: {'_ValidFrom': 1}
       });         
       return deferred.promise;
    },
    _fetchFeatureHash: function(){
    	var deferred = Ext.create('Deft.Deferred');
        var me = this; 
        me.logger.log('_fetchFeatureHash start');
    	Ext.create('Rally.data.lookback.SnapshotStore', {
            scope: this,
            listeners: {
                scope: this,
                load: function(store, data, success){
                    me.logger.log('_fetchFeatureHash returned data',data);
                    Ext.each(data, function(d){
                        var key = d.get('ObjectID').toString();
                        this.featureHash[key] = d.getData();
                    }, this);
                    deferred.resolve(data);
                }
            },
            autoLoad: true,
            fetch: ['Name', 'FormattedID', 'ObjectID'], 
            find: {
                "_TypeHierarchy": "PortfolioItem/Feature",
                "__At": "current"
            },
       });    
       return deferred.promise;
    
    },
    _renderGrid: function(data){
        var columns = [{text: 'FormattedID', dataIndex: 'FormattedID'},
                       {text: 'Name', dataIndex: 'Name', flex: 1},
                       {text: 'Project', dataIndex: 'Project', renderer: this._objectNameRenderer},
                       {text: 'Feature', dataIndex: 'Feature', renderer: this._featureOidRenderer},
                       {text: 'Blocked', dataIndex: 'Blocked'},
                       {text: 'Total Blocked Time (Days)', dataIndex: 'totalBlocked', renderer: this._decimalRenderer}];
            columns.push({text: 'Average Resolution Time (Days)', dataIndex: 'averageResolutionTime', renderer: this._decimalRenderer});
            columns.push({text: '#Durations', dataIndex: 'numDurations'});
            columns.push({text: 'Iteration Blocked In', dataIndex: 'startValue', renderer: this._objectNameRenderer});
            columns.push({text: 'Current Iteration', dataIndex: 'currentValue', renderer: this._objectNameRenderer});

        if (this.down('#data-grid')){
            this.down('#data-grid').destroy();
        }
        
        var grid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'data-grid',
            store: Ext.create('Rally.data.custom.Store', {
                data: data,
                autoLoad: true
            }),
            columnCfgs: columns
        });
        this.down('#display_box').add(grid);
        this.setLoading(false);
    },
    _decimalRenderer: function(v,m,r){
        if (!isNaN(v)){
            return v.toFixed(1);
        }
        return v; 
    },
    _featureOidRenderer: function(v,m,r){
        if (v && typeof v == 'object'){
            return Ext.String.format('{0}: {1}', v.FormattedID, v.Name);
        }
        return v; 
    },
    _objectNameRenderer: function(v,m,r){
        if (v && typeof v == 'object'){
            return v.Name;
        }
        return v;
    },

    _calculateAgingForBlockers: function(snapsByOid){
        this.logger.log('_calculateAgingForBlockers',snapsByOid);
        var desiredFields = ['FormattedID','Name','Feature','Project','BlockedReason','Blocked'];
        var data = [];
        var fromDate = this._getFromDate() || null; 
        
        Ext.Object.each(snapsByOid, function(oid, snaps){
            var fieldObj = AgingCalculator.getFieldHash(snaps, desiredFields);
            var agingObj = AgingCalculator.calculateDurations(snaps,"Blocked",true,fromDate);
            var mobilityObj = AgingCalculator.calculateMobility(snaps,"_PreviousValues.Blocked","Blocked",true,"Iteration");
            var record = _.extend(fieldObj, mobilityObj);
            
            this.logger.log(fieldObj,agingObj,mobilityObj);
            
            record["numDurations"] = agingObj.durations.length;
            record["averageResolutionTime"] = '--';
            if (agingObj.durations.length > 0){
                record["totalBlocked"] = Ext.Array.sum(agingObj.durations);
                var mean_array = agingObj.durations;  
                if (record["Blocked"]){
                    //don't include the current block in the mean.
                    mean_array = agingObj.durations.slice(0,-1);
                } 
                if (mean_array.length > 0){
                    record["averageResolutionTime"] = Ext.Array.mean(mean_array);
                }
                
                if (!this._showOnlyBlockedItems() || (this._showOnlyBlockedItems && record["Blocked"])){
                    data.push(record); 
                }
                
            }
            
        },this);
        this.logger.log('_calculateAgingForBlockers',data);
        this._renderGrid(data);
    },

    _exportData: function(data){
     	var keys = Object.keys(data[0]);
     	var text = keys.join(',') + '\n';
    	Ext.each(data, function(d){
     		Ext.each(keys, function(key){
     			var val = d[key] || '';
     			if (/\n|,|\t/.test(val)){
           			text += Ext.String.format("\"{0}\",", val);
     			} else {
         			text += Ext.String.format("{0},", val);
     			}
     		});
     		text += '\n';
    	});
    	Rally.technicalservices.FileUtilities.saveTextAsFile(text, 'data.csv');
    }
});