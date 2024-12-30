/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 */
 /*
 Date: 07NOV2024
 Author: XGU1
 Descipriton: Project Integration between Quickbase and NetSuite
 */
define(['N/https', 'N/record', 'N/log', 'N/search','N/email', 'N/runtime', 'N/file'], function(https, record, log, search, email, runtime, file) {
    
    function execute(context) {
        try {
			var today = new Date();
			var priorDate = 7;
            today.setDate(today.getDate() - priorDate);
            var year = today.getFullYear();
            var month = ('0' + (today.getMonth() + 1)).slice(-2); 
            var day = ('0' + today.getDate()).slice(-2);
            var formatted_date = year + '-' + month + '-' + day;
			var messagelog = '';
			var message = '';
			var url = 'https://api.quickbase.com/v1/records/query';
			var fid = 177987;
			var json = file.load({ id: fid });
			var contents = json.getContents();
			var config = JSON.parse(contents);
			
            var requestPayload = JSON.stringify({
               "from": config.financialTable,
               "select": [80, 1, 7, 15,9],
			   "where": "{1.GT.'" + formatted_date + "'}"
            });
			
            var response = https.post({
                url: url,
                headers: {
                    'QB-Realm-Hostname': config.quickbaseRealm,
                    'Authorization': 'QB-USER-TOKEN '+config.quickbaseToken,
                    'Content-Type': 'application/json'
                },
                body: requestPayload
            });

            log.debug({
                title: 'Quickbase API Response Status',
                details: response.code
            });
            log.debug({
                title: 'Quickbase API Response Body',
                details: response.body
            });

            var responseBody = JSON.parse(response.body);
			

            if (responseBody.data && responseBody.data.length > 0) {
                responseBody.data.forEach(function(recordData) {
                    var name = recordData['7'].value;
					var midProposal = recordData['80'].value;
                    var dt = recordData['1'].value;
					var proposal = recordData['9'].value;
					var projectprice = recordData['15'].value;
					var date = new Date(dt);
					var month = date.getMonth();
					var day = date.getDate();
					var year = date.getFullYear();
					var createdt = new Date(year, month, day);
					
					if(midProposal===''){
						log.debug({
							title: 'Proposal Not Avaliable',
							details: 'Project Name: ' + name + ' Proposal is empty.'
						});
					} else {
						var existProjectId = searchProjectByProposal(midProposal);
						if(existProjectId){
							/*log.debug({
								title: 'NetSuite ID',
								details: 'ProjectId: ' + existProjectId
							});*/
							messagelog += 'Project ('+name+') existed in NetSuite.\n | ';
						} else {
							/*log.debug({
									title: 'NetSuite Not Found',
									details: 'ProjectId for ' + name +' is not found'
							});*/
						//search client from QB
							var additionalData = fetchClientData(name, config.projectTable, config.clientTable, config.quickbaseRealm, config.quickbaseToken); 
							if (additionalData) {
								/*log.debug({
									title: 'Client Data',
									details: 'Client Name: ' + additionalData.clientname + ', Project Status: ' + additionalData.projecttitle+', Address: '+additionalData.address
								});*/
																
								var clientid = searchcustomerbyclient(additionalData.clientname, additionalData.address);
								if(clientid) {
									var newProjectId = createnewproject(proposal, clientid, createdt, projectprice, additionalData.projecttitle);
									
									
									/*log.debug({
										title: 'Client Existed',
										details: 'Client: '+additionalData.clientname+' existed (ClientID: '+clientid+')'
									});*/
								}
								else {
									message += 'client ('+additionalData.clientname+') for project ('+name+') does not exist in NetSuite | ';
								}
							}
						}
					}
						
					
						
                });

            } else {
                log.debug({
                    title: 'No Records Found',
                    details: 'No records returned from the Quickbase API.'
                });
            }
			if (messagelog !== '') {
				log.debug({
					title: 'Existed Projects',
					details: messagelog
				});
              /*sendEmailNotification(messagelog);
              log.debug('MessagelogMail', 'sendEmailNotification was called.');*/
			}
			
			if (message !== '') {
              	log.debug({
					title: 'Client Not Exist',
					details: message
				});
              /*sendEmailNotification(message);
              log.debug('MessageMail', 'sendEmailNotification was called.');*/
			}
        } catch (e) {
            log.error({
                title: 'Error pulling data from Quickbase',
                details: e.message
            });
        }
    }
	
    function searchProjectByProposal(midProposal) {
		var proposalId = null;
		var projectSearch = search.create({
			type: search.Type.JOB,
			filters: [
				['entityid', 'contains', midProposal]
			],
			columns: ['internalid']
		});

		var searchResult = projectSearch.run().getRange({ start: 0, end: 1 });

		if (searchResult.length > 0) {
			proposalId = searchResult[0].getValue('internalid');
		}

		return proposalId;
    }
	function sendEmailNotification(message) {
		try {
            var senderId = 42232; // Replace with a valid employee ID
            var recipientId = 42232; 
            var subject = 'Email Notification from NetSuite';
            log.debug('sendEmailNotification', 'Preparing to send email...');
            email.send({
                author: senderId,
                recipients: recipientId,
                subject: subject,
                body: message
            });
          log.debug('Email Sent', 'Email notification sent successfully.');
        } catch (e) { // Fix: add parentheses around e
            log.error({
                title: 'Error Notification',
                details: e.message
            });
        }
    }
	function searchcustomerbyclient(clientname, QBAddress) {
		var customerId = null;
		var customerSearch = search.create({
			type: search.Type.CUSTOMER,
			filters: [['companyname', 'is', clientname]], 
			columns: ['internalid']
		});
		var searchResult = customerSearch.run().getRange({ start: 0, end: 1 });

		if (searchResult.length > 0) {
			customerId = searchResult[0].getValue('internalid');
		} else{
			var trimclient = '';
			if (clientname.includes(', Inc.')) {
				trimclient = clientname.replace(', Inc.', '');
			} else if (clientname.includes(', INC.')) {
				trimclient = clientname.replace(', INC.', '');
			} else if (clientname.includes(', Inc')) {
				trimclient = clientname.replace(', Inc', '');
			} else if (clientname.includes(' INC.')) {
				trimclient = clientname.replace(' INC.', '');
			} else if (clientname.includes(' Inc.')) {
				trimclient = clientname.replace(' Inc.', '');
			} else if (clientname.includes(', INC')) {
				trimclient = clientname.replace(', INC', '');
			} else if (clientname.includes(' Inc')) {
				trimclient = clientname.replace(' Inc', '');
			} else if (clientname.includes(' INC')) {
				trimclient = clientname.replace(' INC', '');
			} else if (clientname.includes(', LLC.')) {
				trimclient = clientname.replace(', LLC.', '');
			} else if (clientname.includes(', LLC')) {
				trimclient = clientname.replace(', LLC', '');
			} else if (clientname.includes(' LLC')) {
				trimclient = clientname.replace(' LLC', '');
			}
			customerSearch = search.create({
				type: search.Type.CUSTOMER,
				filters: [['companyname', 'contains', trimclient]],
				columns: ['internalid']
			});
			searchResult = customerSearch.run().getRange({ start: 0, end: 1 });

			if (searchResult.length > 0) {
				customerId = searchResult[0].getValue('internalid');
			}
		}
		return customerId;
	}


	function fetchClientData(name, projectTable, clientTable, realm, token) {
        var additionalData = {};
        var url = 'https://api.quickbase.com/v1/records/query';

        var projectload = JSON.stringify({
            "from": projectTable,
            "select": [16, 25], 
            "where": "{6.EQ.'" + name + "'}"
        });
        var response = https.post({
            url: url,
            headers: {
                'QB-Realm-Hostname': realm,
                'Authorization': 'QB-USER-TOKEN '+token,
                'Content-Type': 'application/json'
            },
            body: projectload
        });

        var responseBody = JSON.parse(response.body);
        /*log.debug({
			title: 'Client Data',
			details: 'Client Info' + response.body
		});*/
        if (responseBody.data && responseBody.data.length > 0) {
            additionalData.clientname = responseBody.data[0]['16'].value;
            additionalData.projecttitle = responseBody.data[0]['25'].value;
			var clientload = JSON.stringify({
				"from": clientTable,
				"select": [9],
				"where": "{6.EQ.'"+responseBody.data[0]['16'].value+"'}"
			});
			var clientResponse = https.post({
				url: url,
				headers: {
					'QB-Realm-Hostname': realm,
					'Authorization': 'QB-USER-TOKEN '+token,
					'Content-Type': 'application/json'
				},
				body: clientload
			});
			var clientBody = JSON.parse(clientResponse.body);
			if (clientBody.data && clientBody.data.length > 0) {
				additionalData.address = clientBody.data[0]['9'].value;
			}
        }
        
        return additionalData;
    }
	function createnewproject(proposal, clientid, createdt, projectprice, projecttitle) {
        try {
            var newProject = record.create({
                type: record.Type.JOB, 
                isDynamic: true 
            });
			newProject.setValue({
                fieldId: 'companyname',
                value: proposal
            });
			newProject.setValue({
                fieldId: 'comments',
                value: projecttitle
            });
            newProject.setValue({
                fieldId: 'parent',
                value: clientid
            });
            newProject.setValue({
                fieldId: 'startdate',
                value: createdt
            });
            newProject.setValue({
                fieldId: 'custentityprojectdept',
                value: 209
            });
            newProject.setValue({
                fieldId: 'entitystatus',
                value: 2
            });

            newProject.setValue({
                fieldId: 'jobbillingtype',
                value: 'FBM'
            });
            newProject.setValue({
                fieldId: 'jobitem',
                value: 62
            });
            newProject.setValue({
                fieldId: 'jobprice',
                value: projectprice
            });

            // Save the new project record
            var projectId = newProject.save({
                enableSourcing: true,
                ignoreMandatoryFields: false
            });

            // Log the newly created project ID
            log.debug({
                title: 'New Project Created',
                details: 'Project ID: ' + projectId
            });
			return projectId;
        } catch (e) {
            log.error({
                title: 'Error Creating Project',
                details: e.message
            });
        }
    }
    return {
        execute: execute
    };
});
