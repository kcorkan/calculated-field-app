Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        
      var current_project_id = this.getContext().getProject().ObjectID;
      console.log(current_project_id)
      
      var promises = [];
      promises.push(this._fetchLookbackStore(current_project_id));
      promises.push(this._fetchLookbackStore2(current_project_id));
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
                    //me._renderGrid(store);
                    deferred.resolve(data);
                }
            },
            autoLoad: true,
            fetch: ['Name','FormattedID','_ProjectHierarchy','Feature','_TypeHierarchy','Blocked','_ValidFrom','_ValidTo','c_BlockerReason','c_BlockerOwner'],
            filters: [{
                      property: '_TypeHierarchy',
                      operator: 'in',
                      value: ['HierarchicalRequirement']
            },{
				property: '_PreviousValues.Blocked',
				value: false
			},{
				property: 'Blocked',
				value: true
			},{
            	property: '_ProjectHierarchy',
            	value: current_project_id
            }]
       });         
    	return deferred.promise;
    	
    },
    _fetchLookbackStore2: function(current_project_id){
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
            fetch: ['Name','FormattedID','_ProjectHierarchy','Feature','_TypeHierarchy','Blocked','_ValidFrom','_ValidTo','c_BlockerReason','c_BlockerOwner'],
            filters: [{
                      property: '_TypeHierarchy',
                      operator: 'in',
                      value: ['HierarchicalRequirement']
            },{
				property: '_PreviousValues.Blocked',
				value: true
			},{
				property: 'Blocked',
				value: false
			},{
            	property: '_ProjectHierarchy',
            	value: current_project_id
            }]
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
        	            text: 'Blocked', dataIndex: 'Blocked'

           	        },{
        	            text: 'Age', dataIndex: 'Age'
           	        }]
    	
        var data_array = this._convertToCustomStore(datas);
        console.log(data_array);
        
    	var grid = Ext.create('Rally.ui.grid.Grid', {
    	    store: Ext.create('Rally.data.custom.Store', {
    	        data: data_array,
    	        autoLoad: true
    	    }),
    	    columnCfgs: columns
    	});
    	this.down('#display_box').add(grid);

    },
    _convertToCustomStore:function(datas){
    	this.logger.log('_convertToCustomStore',datas);
    	var data_hash = {};
    	Ext.each(datas, function(data){
        	console.log(data);
    		Ext.each(data, function(rec){

        		var formatted_id = rec.get('FormattedID');
        		if (!data_hash[formatted_id]){
        			data_hash[formatted_id] = {};
        			data_hash[formatted_id]['StartDate'] = rec.get('_ValidFrom');
        			data_hash[formatted_id]['EndDate'] = rec.get('_ValidFrom');
        		}
        		data_hash[formatted_id]['FormattedID'] = formatted_id;
        		data_hash[formatted_id]['Name'] = rec.get('Name');
        		data_hash[formatted_id]['Project'] = rec.get('Project');
        		data_hash[formatted_id]['Blocked'] = rec.get('Blocked');
        		if (rec.get('Blocked')){
        			data_hash[formatted_id]['StartDate'] = rec.get('_ValidFrom');
        		} else {
        			data_hash[formatted_id]['EndDate'] = rec.get('_ValidFrom');
        		}
        	},this);
    	},this);

        	var data = [];
        	Object.keys(data_hash).forEach(function (key) { 
        		var end_date = new Date(data_hash[key]['EndDate']);
        		var start_date = new Date(data_hash[key]['StartDate']);
        	    var ms = Ext.Date.getElapsed(end_date,start_date);
        	    console.log(ms);
        	    var days = Math.round(ms/1000/60/60/24);
        		data_hash[key]['Age']=days;
        		data.push(data_hash[key]);
        	})
        	this._exportData(data);
        	return data;
    },
    _exportData: function(data){
    	
    }
});