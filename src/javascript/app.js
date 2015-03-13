Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'control_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'button_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    invalidDateString: 'Invalid Date',
    dateFormat: 'MM/dd/YYYY',
    lookbackFetchFields: ['_PreviousValues.Blocked','_SnapshotNumber','Name','FormattedID','_ProjectHierarchy','Feature','_TypeHierarchy','Blocked','_ValidFrom','_ValidTo','BlockedReason','c_BlockerOwnerFirstLast','c_BlockerCategory','c_BlockerCreationDate','DirectChildrenCount','Feature','Iteration'],
    featureHash: {},
    launch: function() {
    	
      //Add Date Picker, set date picker
    	this.down('#control_box').add({
    		xtype: 'rallydatefield',
    		itemId: 'from-date-picker',
    		margin: 10,
    		fieldLabel: 'Date From:',
            labelAlign: 'right'
    	});
    	
    	this.down('#control_box').add({
    		xtype: 'rallycheckboxfield',
    		itemId: 'show-blocked-checkbox',
    		fieldLabel: 'Show only Blocked Items:',
    		labelWidth: 150,
    		labelAlign: 'right',
            margin: 10,
    		value: false
    	});
    	
    	this.down('#control_box').add({
    		xtype: 'rallybutton',
    		itemId: 'run-button',
    		text: 'Run',
            margin: 10,
    		scope:this,
    		handler: this._buildGrid,
    		//disabled: true
    	});
    	this.down('#control_box').add({
    		xtype: 'rallybutton',
    		itemId: 'export-button',
    		text: 'Export',
            margin: 10,
    		scope: this,
    		handler: this._exportData,
    		//disabled: true
    	});
    },
    _buildGrid: function(){
        var current_project_id  = this.getContext().getProject().ObjectID;
        var fromDate = this.down('#from-date-picker').getValue();
        
        this.setLoading(true);
    	this._fetchLookbackStore(current_project_id, fromDate).then({
    	    scope: this,
    	    success: this._calculateAgingForBlockers
    	});
    },
    _fetchLookbackStore: function(currentProjectId, fromDate){
        var deferred = Ext.create('Deft.Deferred');
        
        var find = {};  
        if (fromDate == undefined){
            fromDate = new Date();
            find["Blocked"] = true;  
        } else {
            find["$or"] = [{"_PreviousValues.Blocked":true},{"Blocked": true}];
        }
        var isoFromDate = Rally.util.DateTime.toIsoString(fromDate);

        find["_TypeHierarchy"] = 'HierarchicalRequirement';
        find["_ProjectHierarchy"] = currentProjectId;  
        find["_ValidTo"] = {$gte: isoFromDate};
        
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
                       {text: 'Name', dataIndex: 'Name'},
                       {text: 'Project', dataIndex: 'Project', renderer: this._objectNameRenderer},
                       {text: 'Feature', dataIndex: 'Feature', renderer: this._featureOidRenderer},
                       {text: 'Blocked', dataIndex: 'Blocked'},
                       {text: 'Total Blocked Time (Days)', dataIndex: 'totalBlocked'},
                       {text: 'Average Resolution Time (Days)', dataIndex: 'averageResolutionTime'},
                       {text: '#Durations', dataIndex: 'numDurations'},
                       {text: 'Iteration Blocked In', dataIndex: 'startValue', renderer: this._objectNameRenderer},
                       {text: 'Current Iteration', dataIndex: 'currentValue', renderer: this._objectNameRenderer}]

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
        
        Ext.Object.each(snapsByOid, function(oid, snaps){
            var fieldObj = AgingCalculator.getFieldHash(snaps, desiredFields);
            var agingObj = AgingCalculator.calculateDurations(snaps,"Blocked",true);
            var mobilityObj = AgingCalculator.calculateMobility(snaps,"_PreviousValues.Blocked","Blocked",true,"Iteration");
            var record = _.extend(fieldObj, mobilityObj);
            
            this.logger.log(fieldObj,agingObj,mobilityObj);
            record["numDurations"] = agingObj.durations.length;
            record["averageResolutionTime"] = '';
            if (agingObj.durations.length > 0){
                record["totalBlocked"] = Ext.Array.sum(agingObj.durations);
                var mean_array = agingObj.durations;  
                if (record["Blocked"]){
                    mean_array = agingObj.durations.slice(0,-1);
                } 
                if (mean_array.length > 0){
                    record["averageResolutionTime"] = Ext.Array.mean(mean_array);
                }
                data.push(record);
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