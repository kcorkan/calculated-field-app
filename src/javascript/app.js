Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'control_box',layout:{type:'vbox'}},
        {xtype:'container',itemId:'button_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    invalidDateString: 'Invalid Date',
    dateFormat: 'MM/dd/YYYY',
    lookbackFetchFields: ['_PreviousValues.Blocked','_SnapshotNumber','Name','FormattedID','_ProjectHierarchy','Feature','_TypeHierarchy','Blocked','_ValidFrom','_ValidTo','BlockedReason','c_BlockerOwnerFirstLast','c_BlockerCategory','c_BlockerCreationDate','DirectChildrenCount','Feature'],
    featureHash: {},
    launch: function() {
    	
      //Add Date Picker, set date picker
    	this.down('#control_box').add({
    		xtype: 'rallydatefield',
    		itemId: 'from-date-picker',
    		fieldLabel: 'Date From:'
    	});
    	
    	this.down('#control_box').add({
    		xtype: 'rallycheckboxfield',
    		itemId: 'show-blocked-checkbox',
    		fieldLabel: 'Show only Blocked Items:',
    		value: false
    	});
    	
    	this.down('#button_box').add({
    		xtype: 'rallybutton',
    		itemId: 'run-button',
    		text: 'Run',
    		scope:this,
    		handler: this._buildGrid,
    		disabled: true
    	});
    	this.down('#button_box').add({
    		xtype: 'rallybutton',
    		itemId: 'export-button',
    		text: 'Export',
    		scope: this,
    		handler: this._exportData,
    		//disabled: true
    	});
    	
    	var promises = [];
        promises.push(this._fetchProjects());
        promises.push(this._fetchFeatureHash());
        Deft.Promise.all(promises).then({
    		scope: this,
    		success: function(){
    			this.down('#run-button').setDisabled(false);
    		}
    	});

           
    },
    _buildGrid: function(){
        var current_project_id  = this.getContext().getProject().ObjectID;
    	var promises = [];
        promises.push(this._fetchLookbackStore(current_project_id));
       // promises.push(this._fetchLookbackStore2(current_project_id));
        Deft.Promise.all(promises).then({
  	        scope: this,
  	        success: function(items){
  	            this._renderGrid(items);
  	        },
  	        failure: function(error_msg) { alert(error_msg); }
  	    });
    },
    _fetchLookbackStore: function(current_project_id){
        var deferred = Ext.create('Deft.Deferred');
    	var me = this; 
        me.logger.log('_fetchLookbackStore start');
    	Ext.create('Rally.data.lookback.SnapshotStore', {
            scope: this,
            listeners: {
                scope: this,
                load: function(store, data, success){
                    me.logger.log('fetchLookbackStore returned data',data);
                    deferred.resolve(data);
                }
            },
            autoLoad: true,
            fetch: this.lookbackFetchFields, 
            find: {
            	'_PreviousValues.Blocked': {$ne: null},
            	'_TypeHierarchy': 'HierarchicalRequirement',
            	'_ProjectHierarchy':current_project_id
            },
          sort: {'_ValidFrom': 1}
       });         
    	return deferred.promise;
    	
    },
//    _fetchLookbackStore2: function(current_project_id){
//    	var deferred = Ext.create('Deft.Deferred');
//        var me = this; 
//        me.logger.log('_fetchLookbackStore start');
//    	Ext.create('Rally.data.lookback.SnapshotStore', {
//            scope: this,
//            listeners: {
//                scope: this,
//                load: function(store, data, success){
//                    me.logger.log('fetchLookbackStore returned data',data);
//                    deferred.resolve(data);
//                }
//            },
//            autoLoad: true,
//            fetch: this.lookbackFetchFields, 
//            filters: [{
//                      property: '_TypeHierarchy',
//                      operator: 'in',
//                      value: ['HierarchicalRequirement']
//            },{
//				property: '_PreviousValues.Blocked',
//				value: true
//			},{
//				property: 'Blocked',
//				value: false
//			},{
//            	property: '_ProjectHierarchy',
//            	value: current_project_id
//            }],
//            sort: {"_ValidFrom": 1}
//       });    
//    	return deferred.promise;
//    },
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
                    	var feat = {};

                    	feat['Name'] = d.get('Name');
                    	feat['FormattedID'] = d.get('FormattedID');
                    	var key = d.get('ObjectID').toString();
                    	console.log(key,feat);
                    	this.featureHash[key] = feat;
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
    _renderGrid: function(datas){
    	this.logger.log('_renderGrid');
        var columns = [
           	        {
        	            text: 'FormattedID', dataIndex: 'FormattedID'
        	        },{
        	            text: 'Name', dataIndex: 'Name'
           	        },{
        	            text: 'Project', dataIndex: 'Project'
           	        },{
        	            text: 'StartDate', dataIndex: 'StartDate'
           	        },{
        	            text: 'EndDate', dataIndex: 'EndDate'
           	        },{
           	        	text:'Blocker Reason', dataIndex: 'BlockerReason'
           	        },{
           	        	text:'Blocker Category', dataIndex: 'BlockerCategory'
           	        },{
           	        	text:'Blocker Owner', dataIndex: 'BlockerOwner'
           	        },{
           	        	text:'Blocker Creation Date', dataIndex: 'BlockerCreationDate'
           	        },{
           	        	text:'Feature Name', dataIndex: 'FeatureName'
           	        },{
           	        	text:'Feature FormattedID', dataIndex: 'FeatureFormattedID'
           	        },{
        	            text: 'Blocked', dataIndex: 'Blocked'
           	        },{
        	            text: 'Age', dataIndex: 'Age'
           	        }
           	        
           	        
           	        ]
    	
        var data_array = this._convertToCustomStore(datas);
        
    	var grid = Ext.create('Rally.ui.grid.Grid', {
    	    itemId: 'data-grid',
    		store: Ext.create('Rally.data.custom.Store', {
    	        data: data_array,
    	        autoLoad: true
    	    }),
    	    columnCfgs: columns
    	});
    	this.down('#display_box').add(grid);

    },
    _fetchProjects: function(){
    	this.logger.log('_fetchProjects');
    	var deferred = Ext.create('Deft.Deferred');
    	Ext.create('Rally.data.wsapi.Store', {
    	    model: 'Project',
    	    fetch: ['ObjectID','Name'],
	    	autoLoad: true,
    	    listeners: {
    	    	scope: this, 
    	        load: function(store, data, success) {
    	            this.logger.log('_fetchProjects.load',success);
    	        	if (success) {
        	        	var project_hash = {};
        	        	Ext.each(data, function(d){
        	            	project_hash[d.get('ObjectID').toString()] = d.get('Name');
        	            });
            			this.projectHash = project_hash;
        	            deferred.resolve(project_hash);
    	            } else {
    	            	deferred.reject('Failed to build project mapping.');
    	            }
    	        }
    	    }
    	});   	
    	return deferred;
    },
    _convertToCustomStore:function(datas){
    	this.logger.log('_convertToCustomStore',datas);
    	
    	var data_hash = {};
   	Ext.each(datas, function(data){

    		Ext.each(data, function(rec){
        		var formatted_id = rec.get('FormattedID');
        		//	console.log(formatted_id, rec.get('_SnapshotNumber'),rec.get('_PreviousValues.Blocked'),rec.get('_ValidFrom'));        			
        	
        		if (!data_hash[formatted_id]){
        			data_hash[formatted_id] = {};
        			data_hash[formatted_id]['StartDate'] = this._formatDate(rec.get('_ValidFrom')); //new Date(rec.get('_ValidFrom'));
        			data_hash[formatted_id]['EndDate'] = this._formatDate(new Date()); //new Date(rec.get('_ValidFrom'));
    		    }
    			data_hash[formatted_id]['FormattedID'] = formatted_id;
        		data_hash[formatted_id]['Name'] = rec.get('Name');
        		data_hash[formatted_id]['Project'] = this.projectHash[rec.get('Project').toString()];
        		data_hash[formatted_id]['Blocked'] = rec.get('Blocked');
        		data_hash[formatted_id]['BlockerReason'] = rec.get('BlockedReason');
        		data_hash[formatted_id]['BlockerCategory'] = rec.get('c_BlockerCategory');
        		data_hash[formatted_id]['BlockerCreationDate'] = rec.get('c_BlockerCreationDate');
        		data_hash[formatted_id]['BlockerOwner'] = rec.get('c_BlockerOwnerFirstLast');
        		var feature = this.featureHash[rec.get('Feature').toString()];
        		var feature_name = '';
        		var feature_id = '';
        		if (feature){
            		feature_name =  feature.Name;
            		feature_id = feature.FormattedID;
        		}
        		data_hash[formatted_id]['FeatureName'] = feature_name;  
        		data_hash[formatted_id]['FeatureFormattedID'] = feature_id;
        		data_hash[formatted_id]['DirectChildrenCount'] = rec.get('DirectChildrenCount');
        		
         		if (rec.get('_PreviousValues.Blocked')){
        			data_hash[formatted_id]['EndDate'] = this._formatDate(rec.get('_ValidFrom'));
        		} else {
        			data_hash[formatted_id]['StartDate'] = this._formatDate(rec.get('_ValidFrom'));
        		}
         		
        	},this);
    	},this);

        	var data = [];
        	Object.keys(data_hash).forEach(function (key) { 
        		var end_date = new Date(data_hash[key]['EndDate']);
        		var start_date = new Date(data_hash[key]['StartDate']);
        	    var ms = Ext.Date.getElapsed(end_date,start_date);
        	    var days = Math.round(ms/1000/60/60/24);
        		data_hash[key]['Age']=days;
        		data.push(data_hash[key]);
        	});
        	this._exportData(data);
        	return data;
    },
    _formatDate: function(date_string){
    	if (Date.parse(date_string) > 0){
        	var date = new Date(date_string);
        	return Ext.String.format("{0}/{1}/{2}",date.getMonth()+1,date.getDate(),date.getFullYear());
    	}
    	return this.invalidDateString;
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