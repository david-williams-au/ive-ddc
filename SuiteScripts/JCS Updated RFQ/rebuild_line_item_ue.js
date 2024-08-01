/**
 * 
 * @name:                                       rebuild_line_item_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Tue Oct 04 2022 10:57:54 AM
 * Change Logs:
 * Date                          Author               Description
 * Tue Oct 04 2022 10:57:54 AM -- Patrick Lising -- Initial Creation
 * Tue Oct 18 2022 09:51:00 AM -- Patrick Lising -- Added Custom Status changes
 * Fri Dec 16 2022 9:04:56 AM -- Patrick Lising -- Added logic for make copy
 * Thu Jan 05 2023 12:46:22 AM -- Patrick Lising -- Fixed bugs on filtering of Placeholder replacement items
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Requisition RFQ
 */

define(['N/record', 'N/search', 'N/runtime', 'N/email', './moment.js', 'N/render', 'N/ui/serverWidget'], function (record, search, runtime, email, moment, render, serverWidget) {

  function rebuild_beforeLoad(context) {
    var currentRec = context.newRecord;
    var recId = currentRec.id
    var currForm = context.form;
    var userObj = runtime.getCurrentUser();
    var userRole = userObj.role
    var myScript = runtime.getCurrentScript();
    var hideButton = ''
    var scriptParameterValue = myScript.getParameter({
      name: 'custscript_jcs_create_po_roles'
    });

    log.debug({
      title: 'context.type',
      details: context.type
    })
    var subsidiary = userObj.subsidiary
    if (subsidiary == '2') {

      if (context.type == 'view') {

        if (userRole != scriptParameterValue && userRole != '3') {
          log.debug({
            title: 'userRole != scriptParameterValue',
            details: 'userRole != scriptParameterValue and not an Admin'
          })
          hideButton = 'true'
        }

        log.debug({
          title: 'userRole || scriptParameterValue || hideButton',
          details: userRole + ' || ' + scriptParameterValue + ' || ' + hideButton
        })

        var jobLink = currentRec.getValue({
          fieldId: 'custbody_ddc_rfq_job_link'
        })

        var purchaserequisitionSearchObj = search.create({
          type: "purchaserequisition",
          filters:
            [
              ["type", "anyof", "PurchReq"],
              "AND",
              ["internalid", "anyof", recId],
              "AND",
              ["mainline", "is", "F"],
              "AND",
              ["item", "anyof", "17499", "17500", "17501"]
            ],
          columns:
            [
              search.createColumn({ name: "item", label: "Item" }),
            ]
        });
        var searchResultCount = purchaserequisitionSearchObj.runPaged().count;
        log.debug("placeholder item result count", searchResultCount);

        if (searchResultCount > 0 || jobLink == '' || hideButton == 'true') {
          log.debug({
            title: 'Hide Create PO Button',
            details: 'Hide Create PO Button'
          })

          currForm.removeButton({
            id: 'createpo'
          })
          currForm.removeButton({
            id: 'custpage_create_po'
          })
        }

        // var docStatus = currentRec.getValue({
        //     fieldId: 'status'
        // })

        // log.debug({
        //     title: 'docStatus',
        //     details: docStatus
        // })

        // if (docStatus == 'Fully Ordered') {
        //     log.debug({
        //         title: 'docStatus == Fully Ordered',
        //         details: 'docStatus == Fully Ordered'
        //     })
        //     record.submitFields({
        //         type: record.Type.PURCHASE_REQUISITION,
        //         id: recId,
        //         values: {
        //             'custbody_ddc_rfq_status': 6
        //         }
        //     });
        // }

      } else if (context.type == 'create') {
        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_status',
          value: 1
        })

      } else if (context.type == 'copy') {
        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_status',
          value: 1
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_linked_po',
          value: ''
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_supplier1_bid_resp',
          value: ''
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_supplier2_bid_resp',
          value: ''
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rfq_supplier3_bid_resp',
          value: ''
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rec_rfq_supplier1_pref',
          value: false
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rec_rfq_supplier2_pref',
          value: false
        })

        currentRec.setValue({
          fieldId: 'custbody_ddc_rec_rfq_supplier3_pref',
          value: false
        })

      }


      if (context.type == 'create' || context.type == 'edit') {

        //1

        // var hide1 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier1_contact'
        // });
        // hide1.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var hide2 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier1_altcontact'
        // });
        // hide2.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var custContact1 = currForm.addField({
        //     id: 'custpage_contact1',
        //     label: 'Valid Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // var altCustContact1 = currForm.addField({
        //     id: 'custpage_altcontact1',
        //     label: 'Valid Alternate Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // currForm.insertField({
        //     field: altCustContact1,
        //     nextfield: 'custbody_ddc_rfq_supplier1_bid_resp'
        // });

        // currForm.insertField({
        //     field: custContact1,
        //     nextfield: 'custpage_altcontact1'
        // });

        // //2
        // var hide3 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier2_contact'
        // });
        // hide3.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var hide4 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier2_altcontact'
        // });
        // hide4.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var custContact2 = currForm.addField({
        //     id: 'custpage_contact2',
        //     label: 'Valid Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // var altCustContact2 = currForm.addField({
        //     id: 'custpage_altcontact2',
        //     label: 'Valid Alternate Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // currForm.insertField({
        //     field: altCustContact2,
        //     nextfield: 'custbody_ddc_rfq_supplier2_bid_resp'
        // });

        // currForm.insertField({
        //     field: custContact2,
        //     nextfield: 'custpage_altcontact2'
        // });

        // //3

        // var hide5 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier3_contact'
        // });
        // hide5.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var hide6 = currForm.getField({
        //     id: 'custbody_ddc_rfq_supplier3_altcontact'
        // });
        // hide6.updateDisplayType({
        //     displayType: 'DISABLED'
        // })

        // var custContact3 = currForm.addField({
        //     id: 'custpage_contact3',
        //     label: 'Valid Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // var altCustContact3 = currForm.addField({
        //     id: 'custpage_altcontact3',
        //     label: 'Valid Alternate Contact',
        //     type: serverWidget.FieldType.SELECT
        // })

        // currForm.insertField({
        //     field: altCustContact3,
        //     nextfield: 'custbody_ddc_rfq_supplier3_bid_resp'
        // });

        // currForm.insertField({
        //     field: custContact3,
        //     nextfield: 'custpage_altcontact3'
        // });


        //add sublist script field for placeholder item

        var itemSublist = currForm.getSublist({
          id: 'item'
        })

        var disablePlaceholder = itemSublist.getField({
          id: 'custcol_placeholder_replacement_item'
        })
        disablePlaceholder.updateDisplayType({
          displayType: 'DISABLED'
        })

        var placeholderItemColumn = itemSublist.addField({
          id: 'custpage_placeholderitem',
          label: 'Available Replacement Items',
          type: serverWidget.FieldType.SELECT
        })

        placeholderItemColumn.addSelectOption({
          value: '',
          text: ''
        });

        var customer = currentRec.getValue({
          fieldId: 'custbody_ddc_req_rfq_customer'
        })

        var subsidiary = currentRec.getValue({
          fieldId: 'subsidiary'
        })

        log.debug("customer", customer);
        if (customer) {
          var filterArray = [
            ["subsidiary", "anyof", subsidiary],
            "AND",
            ["type", "anyof", "InvtPart"],
            "AND",
            [["custitem_ddc_owned_by_cust", "anyof", customer], "OR", ["custitem_ddc_is_cust_owned", "is", "F"]]
          ]
        } else {
          var filterArray = [
            ["subsidiary", "anyof", subsidiary],
            "AND",
            ["type", "anyof", "InvtPart"],
            "AND",
            ["custitem_ddc_is_cust_owned", "is", "F"]
          ]
        }

        log.debug("filterArray", filterArray);

        var inventoryitemSearchObj = search.create({
          type: "inventoryitem",
          filters: filterArray,
          columns:
            [
              search.createColumn({ name: "internalid", label: "Internal ID" }),
              search.createColumn({ name: "displayname", label: "Display Name" }),
              search.createColumn({
                name: "itemid",
                sort: search.Sort.ASC,
                label: "Name"
              })
            ]
        });
        var searchResultCount = inventoryitemSearchObj.runPaged().count;
        log.debug("inventoryitemSearchObj result count", searchResultCount);
        inventoryitemSearchObj.run().each(function (result) {
          // .run().each has a limit of 4,000 results

          var id = result.getValue('internalid')
          var displayName = result.getValue('itemid')
          placeholderItemColumn.addSelectOption({
            value: id,
            text: displayName
          });

          return true;
        });

        /*
        inventoryitemSearchObj.id="customsearch1669784841508";
        inventoryitemSearchObj.title="JCS Filtered Item Search (copy)";
        var newSearchId = inventoryitemSearchObj.save();
        */



      }
    }

  } // end of before load trigger

  function rebuild_beforeSubmit(context) {
    var currentUser = runtime.getCurrentUser();
    var subsidiary = currentUser.subsidiary
    if (subsidiary == '2') {
      var currRec = context.newRecord;
      var reqId = currRec.id;
      var replacementItemArr = [];

      var lineCount = currRec.getLineCount({
        sublistId: 'item'
      })

      log.debug({
        title: 'reqId + lineCount',
        details: reqId + ' || ' + lineCount
      })

      //get line items that have placeholder items set
      for (var i = 0; i < lineCount; i++) {

        // var custPlaceholder = currRec.getSublistValue({
        //     sublistId: 'item',
        //     fieldId: 'custpage_placeholderitem',
        //     line: i
        // });

        // log.debug({
        //     title: 'custPlaceholder',
        //     details: 'custPlaceholder value: ' + custPlaceholder
        // })

        var placeholderReplacement = currRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_placeholder_replacement_item',
          line: i
        });

        if (placeholderReplacement) {
          log.debug({
            title: 'placeholderReplacement',
            details: placeholderReplacement
          })

          var lineKey = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            line: i
          });

          var itemDesc = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: i
          });
          var itemUnit = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'units',
            line: i
          });

          var estRate = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'estimatedrate',
            line: i
          });

          var estAmt = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'estimatedamount',
            line: i
          });
          var itemLoc = currRec.getSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: i
          });

          replacementItemArr.push({
            lineKey: lineKey,
            replacementId: placeholderReplacement,
            itemDesc: itemDesc,
            itemUnit: itemUnit,
            estRate: estRate,
            estAmt: estAmt,
            itemLoc: itemLoc
          })

          log.debug({
            title: 'replacementItemArr',
            details: JSON.stringify(replacementItemArr)
          })
        }
      }

      //if there are placeholder items, rebuild the line items
      if (replacementItemArr.length > 0) {

        for (var j = 0; j < replacementItemArr.length; j++) {

          var lineNum = currRec.findSublistLineWithValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            value: replacementItemArr[j].lineKey
          });

          currRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: lineNum,
            value: replacementItemArr[j].replacementId
          });

          currRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: lineNum,
            value: replacementItemArr[j].itemDesc
          });

          currRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'units',
            line: lineNum,
            value: replacementItemArr[j].itemUnit
          });

          if (replacementItemArr[j].estRate > 0) {
            currRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'estimatedrate',
              line: lineNum,
              value: replacementItemArr[j].estRate
            });

          }

          currRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'estimatedamount',
            line: lineNum,
            value: replacementItemArr[j].estAmt
          });

          currRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_placeholder_replacement_item',
            line: lineNum,
            value: ''
          });

        }
      }
    }
    //end of beforesubmit trigger
  }


  function rebuild_afterSubmit(context) {
    var userObj = runtime.getCurrentUser();
    var subsidiary = userObj.subsidiary
    if (subsidiary == '2') {
      var userId = userObj.id
      var currentRec = context.newRecord;
      var reqId = currentRec.id
      var myScript = runtime.getCurrentScript();
      var emailTemplateId = myScript.getParameter({
        name: 'custscript_jcs_email_template'
      });

      log.debug({
        title: 'context type',
        details: context.type
      })

      var email1 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_email_supplier_1'
      })

      var email2 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_email_supplier_2'
      })

      var email3 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_email_supplier_3'
      })

      //create PDF printout, format Email Body

      if (email1 || email2 || email3) {

        var emailList = []
        emailList.push(
          { email1: email1 },
          { email2: email2 },
          { email3: email3 }
        )

        log.debug({
          title: 'emailList',
          details: emailList
        })


        var bidEndDate = currentRec.getValue({
          fieldId: 'custbody_ddc_rfq_bid_end_date'
        })

        var bidEndTime = currentRec.getValue({
          fieldId: 'custbody_ddc_rfq_bid_end_time'
        })

        var endDate = new Date(bidEndDate);
        var finalBidEndDate = moment(endDate).format('DD/MM/YYYY')
        var endTime = new Date(bidEndTime);
        var finalBidEndTime = moment(endTime)
        var formatted = finalBidEndTime.format('HH:mm A')

        var templateContents = record.load({
          type: record.Type.EMAIL_TEMPLATE,
          id: emailTemplateId
        })

        var subject = templateContents.getValue({
          fieldId: 'subject'
        })

        var body = templateContents.getValue({
          fieldId: 'content'
        })
        var addEndDate = body.replace('${transaction.custbody_ddc_rfq_bid_end_date}', finalBidEndDate)
        var finalBody = addEndDate.replace('${transaction.custbody_ddc_rfq_bid_end_time}', formatted)

        log.debug({
          title: 'finalBody',
          details: finalBody
        })

        var pdfFile = render.transaction({
          entityId: reqId,
          printMode: render.PrintMode.PDF
        });


        //proceed to send email
        for (var k = 0; k < emailList.length; k++) {
          if (emailList[k].email1) {
            var recipientId = []

            var contact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier1_contact'
            })
            var altContact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier1_altcontact'
            })
            var cc1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier1_email'
            })

            recipientId.push(contact1, altContact1, cc1)

            log.debug({
              title: 'email1 recipientIds',
              details: recipientId
            })

            sendEmailToList(userId, recipientId, subject, finalBody, pdfFile)

            record.submitFields({
              type: record.Type.PURCHASE_REQUISITION,
              id: reqId,
              values: {
                'custbody_ddc_rfq_email_supplier_1': 'F'
              }
            });

          } else if (emailList[k].email2) {

            var recipientId = []

            var contact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier2_contact'
            })
            var altContact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier2_altcontact'
            })
            var cc1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier2_email'
            })

            recipientId.push(contact1, altContact1, cc1)

            log.debug({
              title: 'email2 recipientIds',
              details: recipientId
            })

            sendEmailToList(userId, recipientId, subject, finalBody, pdfFile)

            record.submitFields({
              type: record.Type.PURCHASE_REQUISITION,
              id: reqId,
              values: {
                'custbody_ddc_rfq_email_supplier_2': 'F'
              }
            });

          } else if (emailList[k].email3) {
            var recipientId = []

            var contact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier3_contact'
            })
            var altContact1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier3_altcontact'
            })
            var cc1 = currentRec.getValue({
              fieldId: 'custbody_ddc_rfq_supplier3_email'
            })

            recipientId.push(contact1, altContact1, cc1)

            log.debug({
              title: 'email3 recipientIds',
              details: recipientId
            })

            sendEmailToList(userId, recipientId, subject, finalBody, pdfFile)

            record.submitFields({
              type: record.Type.PURCHASE_REQUISITION,
              id: reqId,
              values: {
                'custbody_ddc_rfq_email_supplier_3': 'F'
              }
            });

          }

        }

        //set status to RFQ sent to suppliers

        record.submitFields({
          type: record.Type.PURCHASE_REQUISITION,
          id: reqId,
          values: {
            'custbody_ddc_rfq_status': 2
          }
        });

      }

      //update custom status field on RFQ

      var bidResponse1 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_supplier1_bid_resp'
      })

      var bidResponse2 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_supplier2_bid_resp'
      })

      var bidResponse3 = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_supplier3_bid_resp'
      })

      var prefVendorQuote = currentRec.getValue({
        fieldId: 'custbody_ddc_vendor_quote_num'
      })

      var docStatus = currentRec.getValue({
        fieldId: 'status'
      })

      var currentStatus = currentRec.getValue({
        fieldId: 'custbody_ddc_rfq_status'
      })

      if (currentStatus != '5') {
        if ((bidResponse1 || bidResponse2 || bidResponse3) && !(prefVendorQuote) && docStatus != 'Fully Ordered') { //if any supplier response is recorded, change status to bids received
          record.submitFields({
            type: record.Type.PURCHASE_REQUISITION,
            id: reqId,
            values: {
              'custbody_ddc_rfq_status': 3
            }
          });
        } else if (prefVendorQuote && docStatus != 'Fully Ordered') { // if preferred vendor quote is available, set status to winning bid finalised
          record.submitFields({
            type: record.Type.PURCHASE_REQUISITION,
            id: reqId,
            values: {
              'custbody_ddc_rfq_status': 4
            }
          });
        } else if (docStatus == 'Fully Ordered') {
          log.debug({
            title: 'docStatus == Fully Ordered',
            details: 'docStatus == Fully Ordered'
          })
          record.submitFields({
            type: record.Type.PURCHASE_REQUISITION,
            id: reqId,
            values: {
              'custbody_ddc_rfq_status': 6
            }
          });
        }
      }
    }

  } //end of after submit trigger

  function sendEmailToList(userId, recipientArr, subject, finalBody, pdfFile) {
    for (var index = 0; index < recipientArr.length; index++) {
      if (index < 2) {
        if (recipientArr[index] != '') {
          var contactHasEmail = search.lookupFields({
            type: search.Type.CONTACT,
            id: recipientArr[index],
            columns: ['email']
          })
          if (contactHasEmail.email) {
            email.send({
              author: userId,
              recipients: recipientArr[index],
              subject: subject,
              body: finalBody,
              attachments: [pdfFile]
            });
            log.debug({
              title: 'Email',
              details: 'Email Sent to: ' + recipientArr[index]
            })
          }
        }

      } else {
        if (recipientArr[index] != '') {
          email.send({
            author: userId,
            recipients: recipientArr[index],
            subject: subject,
            body: finalBody,
            attachments: [pdfFile]
          });
          log.debug({
            title: 'Email',
            details: 'Email Sent to: ' + recipientArr[index]
          })
        }
      }


    }
  }

  return {
    beforeLoad: rebuild_beforeLoad,
    beforeSubmit: rebuild_beforeSubmit,
    afterSubmit: rebuild_afterSubmit
  }
});