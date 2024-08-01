/**
 * @name:                                       prepay_stock_po_ue.js
 * @author:                                     Patrick Lising
 * @summary:                                    Script Description
 * @copyright:                                  © Copyright by Jcurve Solutions
 * Date Created:                                Wed Nov 09 2022 8:26:31 AM
 * Change Logs:
 * Date                          Author               Description
 * Wed Nov 09 2022 8:26:31 AM -- Patrick Lising -- Initial Creation
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

/**
 * @deployedto Purchase Order
 */

define(['N/record', 'N/search', 'N/runtime'], function (record, search, runtime) {

  function prepay_bill_beforeLoad(context) {

    if (context.type == "create") {
      var poRec = context.newRecord;
      //var poSubsidiary=poRec.getValue('custbody_bill_subsidiary');
      //if(!poSubsidiary){
      poSubsidiary = poRec.getValue({
        fieldId: 'subsidiary'
      })
      //}

      if (poSubsidiary == '2') {

        log.debug({
          title: 'beforeLoad',
          details: 'beforeLoad change custom form'
        })

        poRec.setValue({
          fieldId: 'customform',
          value: 191
        })
      }

    }
  }

  function prepay_po_beforeSubmit(context) {
    log.debug("context", context)
    var contextType = runtime.executionContext;
    log.debug("contextType", contextType);
    log.debug("context.type", context.type);
    if (context.type == "create") {
      //if (context.type == "create" || context.type == "edit") {
      var poRec = context.newRecord;
      //var subsidiary=poRec.getValue('custbody_bill_subsidiary');
      //if(!subsidiary){
      var subsidiary = poRec.getValue('subsidiary');

      //}
      log.debug("subsidiary", subsidiary);
      //adding validation to only run script if subsidiary is == 2 (DDC subsidiary)
      if (subsidiary != '2') {
        return;
      }

      var afterForm = poRec.getValue({
        fieldId: 'customform'
      })

      log.debug({
        title: 'beforeSubmit Form',
        details: 'beforeSubmit Form: ' + afterForm
      })
      var isAsN = poRec.getValue('custbody_ddc_asn_cb');
      if (isAsN) {
        return;
      }
      var lineCount = poRec.getLineCount({
        sublistId: "item"
      })
      log.debug("lineCount ", lineCount)

      //make coppy
      for (var i_Remove = lineCount - 1; i_Remove >= 0; i_Remove--) {
        var itemID = poRec.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i_Remove,
        });
        log.debug("itemID", itemID);
        if (itemID == 17502 || itemID == 17503) {
          // poRec.selectLine({
          //     sublistId: 'item',
          //     line: i_Remove
          // });
          poRec.removeLine({
            sublistId: 'item',
            line: i_Remove,
            ignoreRecalc: true

          });
        }

      }
      lineCount = poRec.getLineCount({
        sublistId: "item"
      })
      log.debug("lineCount1 ", lineCount)
      for (var i = 0; i < lineCount; i++) {

        var itemId = poRec.getSublistValue({
          sublistId: "item",
          fieldId: "item",
          line: i
        })

        var itemLookup = search.lookupFields({
          type: search.Type.ITEM,
          id: itemId,
          columns: 'custitem_ddc_is_cust_owned'
        })

        var customerOwned = itemLookup.custitem_ddc_is_cust_owned

        log.debug({
          title: 'customerOwned',
          details: 'customerOwned val: ' + customerOwned
        })

        if (customerOwned) { //if customer owned, insert same line

          var vendorId = poRec.getValue({
            fieldId: 'entity'
          })

          var intercompanyVendor = search.lookupFields({
            type: search.Type.VENDOR,
            id: vendorId,
            columns: 'representingsubsidiary'
          })

          log.debug({
            title: 'intercompanyVendor',
            details: 'intercompanyVendor val: ' + intercompanyVendor.length
          })


          var receivingSubsidiary = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "targetsubsidiary",
            line: i
          })

          var receivingLocation = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "targetlocation",
            line: i
          })

          var itemQty = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            line: i
          })
          var amount = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "amount",
            line: i
          })

          var itemRate = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "rate",
            line: i
          })

          var isClosed = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "isclosed",
            line: i
          })

          var legalEntity = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "cseg_legal_entity",
            line: i
          })
          var itemName = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_po_itemid",
            line: i
          })
          var untSale = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "custcol_ddc_unit_sale",
            line: i
          })
          var description = poRec.getSublistValue({
            sublistId: "item",
            fieldId: "description",
            line: i
          })
          if (description) {
            var descriptionCustomerPrepay = itemName + "-" + description
          }
          else {
            var descriptionCustomerPrepay = itemName
          }

          //set the Rate of original item to 0

          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            line: i,
            value: 0
          });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            line: i,
            value: 0
          });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_po_stored_item_amount',
            line: i,
            value: amount
          });
          //store item rate
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_po_stored_item_rate',
            line: i,
            value: itemRate
          });

          //insert new line as original item but change some columns
          poRec.insertLine({
            sublistId: 'item',
            line: lineCount,
          });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'rate',
            line: lineCount,
            value: itemRate
          });
          if (intercompanyVendor.length > 0) {
            poRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: lineCount,
              value: 17503
            });
            poRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'amount',
              line: lineCount,
              value: amount
            });

          } else {
            poRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: lineCount,
              value: 17502
            });
            poRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'amount',
              line: lineCount,
              value: amount
            });
          }

          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: lineCount,
            value: itemQty
          });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: lineCount,
            value: itemQty
          });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'description',
            line: lineCount,
            value: descriptionCustomerPrepay
          });

          log.debug({
            title: 'targetsubsidiary',
            details: 'targetsubsidiary val: ' + receivingSubsidiary
          })


          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'targetsubsidiary',
            line: lineCount,
            value: receivingSubsidiary
          });

          log.debug({
            title: 'targetlocation',
            details: 'targetlocation val: ' + receivingLocation
          })


          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'targetlocation',
            line: lineCount,
            value: receivingLocation
          });
          poRec.setSublistValue(
            {
              sublistId: 'item',
              fieldId: 'custcol_rec_sub',
              line: lineCount,
              value: receivingSubsidiary
            });
          poRec.setSublistValue(
            {
              sublistId: 'item',
              fieldId: 'custcol_rec_loc',
              line: lineCount,
              value: receivingLocation
            });
          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'isclosed',
            line: lineCount,
            value: isClosed
          });

          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'cseg_legal_entity',
            line: lineCount,
            value: legalEntity
          });

          poRec.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_ddc_exclude_pdf',
            line: lineCount,
            value: true
          });
          log.debug("untSale", untSale);
          if (untSale) {
            poRec.setSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_ddc_unit_sale',
              line: lineCount,
              value: untSale
            });
          }


        }
      }

    }

  }


  return {
    beforeLoad: prepay_bill_beforeLoad,
    beforeSubmit: prepay_po_beforeSubmit
  }
});