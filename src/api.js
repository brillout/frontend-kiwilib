//adapts API
//glues API logic with front-end logic
utils.module.save('api', (function(){
    var endpoint = utils.module.load('endpoint');

    var generator = (function(){
        var userGroupId;
        return {
            load_nodes: function(endpoint_leaf,endpoint_node){ 
                return function(callback){
                    function checkRet(ret){
                        if( !ret || ret.constructor!==Array ) {
                            utils.assert(false);
                            return false;
                        }
                        return true;
                    }
                    endpoint_node(function(groupsArr){
                        if( !checkRet(groupsArr) ) groupsArr=[];
                        var groups = {};
                        groupsArr.forEach(function(g){utils.assert(g['id']&&g.type);groups[g['id']]=g;});
                        endpoint_leaf(function(singles){
                            if( !checkRet(singles) ) singles=[];
                            var ret = [];
                            singles.forEach(function(s){
                                utils.assert(s['groups'],'missing groups');
                                utils.assert(!s.isGroup,'a tag/sensor/user mistakenly set a group');
                                s['groups'].forEach(function(group){
                                    utils.assert(group.type&&group['id']);
                                    s = JSON.parse(JSON.stringify(s)); //angular doesn't want to scope several times over a single object
                                    if( groups[group.id] ) {
                                        if( !groups[group.id].childs ) groups[group.id].childs = [];
                                        groups[group.id].childs.push(s);
                                    }
                                    else {
                                        utils.assert(false,'group contradictory both with and without permission');
                                        ret.push(s);
                                    }
                                });
                            });
                            for(var i in groups) ret.push(groups[i]);
                            callback(ret);
                        });
                    });
                }
            }, 
            alter_group_add: function(endpoint_add){ 
                return function (arg,callback){
                    function do_(){ endpoint_add(arg,userGroupId,callback) }
                    if(!userGroupId) endpoint.users.getMyself(function(ret){
                        userGroupId = ret.groups[0].id;
                        do_();
                    });
                    else do_();
                }
            } 
        };
    })();

    var api = {
        config : {},
        user : (function(){ 
            var userName = (function(){ 
                var STORAGE_KEY = 'user_name';
                return {
                    get: function()   { return utils.storage.get(STORAGE_KEY)    },
                    set: function(val){        utils.storage.set(STORAGE_KEY,val)},
                    del: function()   {        utils.storage.del(STORAGE_KEY)    }
                };
            })(); 
            return {
                getName    : function(){ return userName.get(); },
                isSigned   : function(){ return endpoint._config.isSigned(); },
                signout    : function(){ endpoint.session.signout   ();userName.del(); },
                signoutAll : function(){ endpoint.session.signoutAll();userName.del(); },
                signin     : function(uname,pw,callback){ 
                    endpoint.session.signin(uname,pw,function(){
                        userName.set(uname);
                        if( callback ) callback();
                    });
                }, 
                signup     : function(uname,pw,callback){ 
                    var that = this;
                    endpoint.users.register(uname,pw,function(){
                        that.signin(uname,pw,callback);
                    });
                } 
            };
        })(), 
        load: { 
            singles: {
                tag    : endpoint.tags.get,
                sensor : endpoint.sensors.get
            },
            groups: {
                sensor : generator.load_nodes(endpoint.sensors.get   ,endpoint.groups.sensor.get),
                tag    : generator.load_nodes(endpoint.tags   .get   ,endpoint.groups.tag   .get),
                user   : generator.load_nodes(endpoint.users  .getAll,endpoint.groups.user  .get)
            },
            permissions: {
               sensor  : endpoint.permissions.tags,
               tag     : endpoint.permissions.sensors
            }
        }, 
        alter: { 
            group: {
                add: {
                    sensor : generator.alter_group_add(endpoint.groups.sensor.create),
                    tag    : generator.alter_group_add(endpoint.groups.tag   .create),
                    user   : generator.alter_group_add(endpoint.groups.user  .create)
                },
                remove: {
                    sensor : endpoint.groups.sensor.remove,
                    tag    : endpoint.groups.tag   .remove,
                    user   : endpoint.groups.user  .remove
                }
            },
            permission: {
                add    : endpoint.permissions.post,
                remove : endpoint.permissions.remove
            },
            system: {
                add_sensor : endpoint.manufacturing.sensor,
                add_tag    : endpoint.manufacturing.tag
            },
            open : endpoint.sensors.open
        } 
    };

    endpoint._config.onBeforeRequest=function(){ api.config.onBeforeRequest && api.config.onBeforeRequest() };
    endpoint._config.onAfterRequest =function(){ api.config.onAfterRequest  && api.config.onAfterRequest () };

    return api;
})());

