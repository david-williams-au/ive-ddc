/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
 * @deployedto Requisition RFQ
 */

define(['N/record', 'N/search', 'N/url', 'N/runtime', 'N/format'],
  /**
   * @param {record} record
   * @param {search} search
   */
  function (record, search, url, runtime, format) {

    /**
 * Defines the function definition that is executed before record is loaded.
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
 * @param {Form} scriptContext.form - Current form
 * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
 * @since 2015.2
 */
    function beforeLoad(scriptContext) {
      try {
        log.debug("scriptContext", scriptContext)
        if (scriptContext.type == "create") {
          log.debug("create", "create");
          var subsidiary = scriptContext.newRecord.getValue({ fieldId: 'custbody_bill_subsidiary' });
          if (!subsidiary) {
            subsidiary = scriptContext.newRecord.getValue({ fieldId: 'subsidiary' });
          }
          log.debug("subsidiary", subsidiary);
          if (subsidiary != '2') {
            return;
          }
          var form = scriptContext.form;
          var stdFld = form.getField({ id: 'custbody_ddc_rfq_supplier1_contact' });
          stdFld.updateDisplayType({ displayType: 'hidden' });
          var custFld = form.addField({ id: 'custpage_purchase_contact1', label: 'contact', type: 'select' });
          form.insertField({ field: custFld, nextfield: 'custbody_ddc_rfq_supplier1_contact' });
          custFld.addSelectOption({
            value: '',
            text: ''
          })
          var stdFldAltContact = form.getField({ id: 'custbody_ddc_rfq_supplier1_altcontact' });
          stdFldAltContact.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt1 = form.addField({ id: 'custpage_alt_contact1', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt1, nextfield: 'custbody_ddc_rfq_supplier1_contact' });
          custFldAlt1.addSelectOption({
            value: '',
            text: ''
          })
          //
          var stdFld2 = form.getField({ id: 'custbody_ddc_rfq_supplier2_contact' });
          stdFld2.updateDisplayType({ displayType: 'hidden' });
          var custFld2 = form.addField({ id: 'custpage_purchase_contact2', label: 'contact', type: 'select' });
          form.insertField({ field: custFld2, nextfield: 'custbody_ddc_rfq_supplier2_contact' });
          custFld2.addSelectOption({
            value: '',
            text: ''
          })
          var stdFldAltContact2 = form.getField({ id: 'custbody_ddc_rfq_supplier2_altcontact' });
          stdFldAltContact2.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt2 = form.addField({ id: 'custpage_alt_contact2', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt2, nextfield: 'custbody_ddc_rfq_supplier2_contact' });
          custFldAlt2.addSelectOption({
            value: '',
            text: ''
          })
          //
          var stdFld3 = form.getField({ id: 'custbody_ddc_rfq_supplier3_contact' });
          stdFld3.updateDisplayType({ displayType: 'hidden' });
          var custFld3 = form.addField({ id: 'custpage_purchase_contact3', label: 'contact', type: 'select' });
          form.insertField({ field: custFld3, nextfield: 'custbody_ddc_rfq_supplier3_contact' });
          custFld3.addSelectOption({
            value: '',
            text: ''
          })
          var stdFldAltContact3 = form.getField({ id: 'custbody_ddc_rfq_supplier3_altcontact' });
          stdFldAltContact3.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt3 = form.addField({ id: 'custpage_alt_contact3', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt3, nextfield: 'custbody_ddc_rfq_supplier3_contact' });
          custFldAlt3.addSelectOption({
            value: '',
            text: ''
          })

        }
        if (scriptContext.type == "edit") {
          var subsidiary = scriptContext.newRecord.getValue({ fieldId: 'custbody_bill_subsidiary' });
          if (!subsidiary) {
            subsidiary = scriptContext.newRecord.getValue({ fieldId: 'subsidiary' });
          }
          log.debug("subsidiary", subsidiary);
          if (subsidiary != '2') {
            return;
          }
          var vendorID = scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier1' });
          log.debug("vendorID", vendorID);
          var form = scriptContext.form;
          var stdFld = form.getField({ id: 'custbody_ddc_rfq_supplier1_contact' });
          stdFld.updateDisplayType({ displayType: 'hidden' });
          var custFld = form.addField({ id: 'custpage_purchase_contact1', label: 'contact', type: 'select' });
          form.insertField({ field: custFld, nextfield: 'custbody_ddc_rfq_supplier1_contact' });

          var stdFldAltContact = form.getField({ id: 'custbody_ddc_rfq_supplier1_altcontact' });
          stdFldAltContact.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt1 = form.addField({ id: 'custpage_alt_contact1', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt1, nextfield: 'custbody_ddc_rfq_supplier1_contact' });


          custFld.addSelectOption({
            value: '',
            text: ''
          })
          custFldAlt1.addSelectOption({
            value: '',
            text: ''
          })
          if (vendorID) {
            var dropDownlist = getContactList(vendorID)
            for (var i = 0; i < dropDownlist.length; i++) {
              custFld.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier1_contact' })) == parseInt(dropDownlist[i].value)
              })
              custFldAlt1.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier1_altcontact' })) == parseInt(dropDownlist[i].value)
              })
            }
          }

          //
          var vendorID2 = scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier2' });
          log.debug("vendorID2", vendorID2);

          var stdFld2 = form.getField({ id: 'custbody_ddc_rfq_supplier2_contact' });
          stdFld2.updateDisplayType({ displayType: 'hidden' });
          var custFld2 = form.addField({ id: 'custpage_purchase_contact2', label: 'contact', type: 'select' });
          form.insertField({ field: custFld2, nextfield: 'custbody_ddc_rfq_supplier2_contact' });

          var stdFldAltContact2 = form.getField({ id: 'custbody_ddc_rfq_supplier2_altcontact' });
          stdFldAltContact2.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt2 = form.addField({ id: 'custpage_alt_contact2', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt2, nextfield: 'custbody_ddc_rfq_supplier2_contact' });


          custFld2.addSelectOption({
            value: '',
            text: ''
          })
          custFldAlt2.addSelectOption({
            value: '',
            text: ''
          })
          if (vendorID2) {
            var dropDownlist = getContactList(vendorID2)
            for (var i = 0; i < dropDownlist.length; i++) {
              custFld2.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier2_contact' })) == parseInt(dropDownlist[i].value)
              })
              custFldAlt2.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier2_altcontact' })) == parseInt(dropDownlist[i].value)
              })
            }
          }

          //
          var vendorID3 = scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier3' });
          log.debug("vendorID3", vendorID3);

          var stdFld3 = form.getField({ id: 'custbody_ddc_rfq_supplier3_contact' });
          stdFld3.updateDisplayType({ displayType: 'hidden' });
          var custFld3 = form.addField({ id: 'custpage_purchase_contact3', label: 'contact', type: 'select' });
          form.insertField({ field: custFld3, nextfield: 'custbody_ddc_rfq_supplier3_contact' });

          var stdFldAltContact3 = form.getField({ id: 'custbody_ddc_rfq_supplier3_altcontact' });
          stdFldAltContact3.updateDisplayType({ displayType: 'hidden' });
          var custFldAlt3 = form.addField({ id: 'custpage_alt_contact3', label: 'ALTERNATE CONTACT', type: 'select' });
          form.insertField({ field: custFldAlt3, nextfield: 'custbody_ddc_rfq_supplier3_contact' });


          custFld3.addSelectOption({
            value: '',
            text: ''
          })
          custFldAlt3.addSelectOption({
            value: '',
            text: ''
          })
          if (vendorID3) {
            var dropDownlist = getContactList(vendorID3)
            for (var i = 0; i < dropDownlist.length; i++) {
              custFld3.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier3_contact' })) == parseInt(dropDownlist[i].value)
              })
              custFldAlt3.addSelectOption({
                value: dropDownlist[i].value,
                text: dropDownlist[i].text,
                isSelected: parseInt(scriptContext.newRecord.getValue({ fieldId: 'custbody_ddc_rfq_supplier3_altcontact' })) == parseInt(dropDownlist[i].value)
              })
            }
          }

        }

      } catch (error) {
        log.debug("error", error);
      }


    }

    function getContactList(vendor) {
      var ret = [];
      var contactSearchObj = search.create({
        type: "contact",
        filters:
          [
            ["company", "anyof", vendor],
            "AND",
            ["email", "isnotempty", ""]
          ],
        columns:
          [
            search.createColumn({ name: "internalid", label: "Internal ID" }),
            search.createColumn({
              name: "entityid",
              sort: search.Sort.ASC,
              label: "Name"
            }),
            search.createColumn({ name: "company", label: "Company" })
          ]
      });
      var searchResultCount = contactSearchObj.runPaged().count;
      log.debug("contactSearchObj result count", searchResultCount);
      contactSearchObj.run().each(function (result) {
        // .run().each has a limit of 4,000 results

        var intId = result.getValue('internalid')
        var txtVal = result.getValue('entityid')
        ret.push({
          value: intId,
          text: txtVal

        })
        return true;
      });
      return ret;
    }
    /**
    * Defines the function definition that is executed before record is submitted.
    * @param {Object} scriptContext
    * @param {Record} scriptContext.newRecord - New record
    * @param {Record} scriptContext.oldRecord - Old record
    * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
    * @since 2015.2
    */
    function beforeSubmit(scriptContext) {
      try {
        var rec = scriptContext.newRecord;
        var purcharseContact = rec.getValue('custpage_purchase_contact1')
        log.debug("purcharseContact", purcharseContact)
        if (purcharseContact) {
          rec.setValue('custbody_ddc_rfq_supplier1_contact', parseInt(purcharseContact));
        }

        var altContact = rec.getValue('custpage_alt_contact1')
        log.debug("altContact", altContact)
        if (altContact) {
          rec.setValue('custbody_ddc_rfq_supplier1_altcontact', parseInt(altContact));
        }
        var purcharseContact2 = rec.getValue('custpage_purchase_contact2')
        log.debug("purcharseContact", purcharseContact2)
        if (purcharseContact2) {
          rec.setValue('custbody_ddc_rfq_supplier2_contact', parseInt(purcharseContact2));
        }

        var altContact2 = rec.getValue('custpage_alt_contact2')
        log.debug("altContact2", altContact2)
        if (altContact2) {
          rec.setValue('custbody_ddc_rfq_supplier2_altcontact', parseInt(altContact2));
        }

        //
        var purcharseContact3 = rec.getValue('custpage_purchase_contact3')
        log.debug("purcharseContact3", purcharseContact3)
        if (purcharseContact3) {
          rec.setValue('custbody_ddc_rfq_supplier3_contact', parseInt(purcharseContact3));
        }

        var altContact3 = rec.getValue('custpage_alt_contact3')
        log.debug("altContact3", altContact3)
        if (altContact3) {
          rec.setValue('custbody_ddc_rfq_supplier3_altcontact', parseInt(altContact3));
        }



      } catch (error) {
        log.debug("error", error);
      }



    }
    return {
      beforeLoad: beforeLoad,
      beforeSubmit: beforeSubmit
    };
  });
1