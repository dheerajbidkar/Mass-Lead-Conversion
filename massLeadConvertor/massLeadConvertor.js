import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import leadRecords from '@salesforce/apex/LeadConvertorController.fetchleads';
import Seleted_leadRecords from '@salesforce/apex/LeadConvertorController.SelectedleadsReturn';
import leadConvertIds from '@salesforce/apex/LeadConvertorController.convertLead';
//import filteredData from '@salesforce/apex/LeadConvertorController.fetchRecordsByFilter';
import USER_PROFILE_NAME from '@salesforce/schema/User.Profile.Name';
import USER_ID from '@salesforce/user/Id';
import { loadScript } from "lightning/platformResourceLoader";
import CONFETTI from "@salesforce/resourceUrl/confetti";

export default class MassLeadConvertor extends NavigationMixin(LightningElement) {
    @track refreshData = [];        //refresh data after convertion
    @track records = [];             //All records to display
    @track selectedLeads = [];      //Selected leads to converting
    @track userProfile;             //get user profile name
    @track SaveButtonAccees = true; //gives access to save button to user
    @track recordSize = 0;          //Total number of records
    @track currentNumber = 0;       // Start counting from 0
    @track filteredData = [];       // To store and display the filtered records
    @track uniqueLeads = []; 
    @track allCheckboxSelected = false; // To check if all checkboxes are selected
    @track noOfSelectedRecords = 0;   // Total number of selected records
    @track orgUrl;
    @track showSpinner = false;

    connectedCallback() {
        // Get the current org URL using window.location.origin
        this.orgUrl = window.location.origin;

        Promise.all([loadScript(this, CONFETTI )])
        .then(()=>{
          this.setUpCanvas();
        })
        .catch(error => {
          console.log(error)
        });
    }

    // Lifecycle hook to start the automatic counter
     renderedCallback() {
        this.startCounting();
    }

    // Wire service to get current user's profile name
    @wire(getRecord, { recordId: USER_ID, fields: [USER_PROFILE_NAME] })
    currentUserInfo({ error, data }) {
        if (data) {
            this.userProfile = data.fields.Profile.value.fields.Name.value;
        } else if (error) {
            this.error = error;
        }
    }

    // Wire to fetch lead records
    @wire(leadRecords) wiredLeadRecord(result) {
        this.refreshData = result;

        console.log(this.refreshData.length);
        const { data, error } = result;
        if (data) {
            this.records = data.map((record, index) => ({
                ...record,
                IndexNumber: index + 1 // Increment row index by 1 for display
            }));
            this.recordSize = data.length;
        } else if (error) {
            this.showToastMessage('Error fetching Lead data', error.body.message, 'error');
        }
    }

    // Function to handle the search button click
    handleSearch() {
        filteredData({ whereClause : this.whereClause, searchedValue: this.searchValue }).then(result => {
            const getFilteredData = result.map((record, index) => ({
                ...record,
                IndexNumber: index + 1 // Increment row index by 1 for display
            }));
            
        })
    }

    // Handle individual checkbox selection
    checkbox(event) {
        const checkboxInput = event.target.checked;
        const LeadId = event.target.dataset.id;

        if (checkboxInput) {
            if (!this.selectedLeads.includes(LeadId)) {
                this.selectedLeads.push(LeadId);
                this.noOfSelectedRecords = this.selectedLeads.length;
            }
        } else {
            const index = this.selectedLeads.indexOf(LeadId);
            if (index !== -1) {
                this.selectedLeads.splice(index, 1);
                this.noOfSelectedRecords -= 1;
            }
        }
        if (this.selectedLeads.length > 0) {
            this.SaveButtonAccees = false;  // Enable Save button
        } else if(this.selectedLeads.length == 0){
            this.SaveButtonAccees = true;   // Disable Save button if no leads are selected
        }
    }

    // Handle "Select All" checkbox
   async SelectAllCheckbox(event) {
        this.allCheckboxSelected = event.target.checked;
        const checkboxInputs = this.template.querySelectorAll('lightning-input[data-id]');
    
        if (this.allCheckboxSelected) {
            this.selectedLeads = [...this.records.map(record => record.Id)]; // Select all lead IDs
            this.noOfSelectedRecords = this.selectedLeads.length;

         await checkboxInputs.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedLeads.push(checkbox.dataset.id);
                
            });
        } else {
            this.selectedLeads = [];
            this.noOfSelectedRecords = this.selectedLeads.length;
           await checkboxInputs.forEach(checkbox => {
                checkbox.checked = false;
                this.selectedLeads.splice(this.selectedLeads.indexOf(checkbox.dataset.id), 1);
                
            });
        }
         // Disabled Save button if at less than one lead
        this.SaveButtonAccees = this.selectedLeads.length === 0;
    }

    // Save leads and perform conversion
 async SaveOnData() {
    this.showSpinner = true;

        // Call the Apex method to get the selected lead records
        const result = await Seleted_leadRecords({ SelectedLeads: this.selectedLeads });
        const SelectedRecordArray = result;

        // Filter unique leads based on the 'Phone' field
        const unique = SelectedRecordArray.filter((item, index, self) => {
            return index === self.findIndex((lead) => 
                lead.FirstName === item.FirstName &&
                lead.LastName === item.LastName &&
                lead.Phone === item.Phone &&
                lead.Company === item.Company
            );
        });

        // Set the unique leads to the component property
        this.uniqueLeads = unique;
        
         // Check user profile to allow lead conversion
        if (this.userProfile === 'System Administrator' || this.userProfile === 'Standard User Copy') {

             // Call the Apex method to convert leads
          await leadConvertIds({ leads: this.uniqueLeads })
                .then(result => {
                    this.showSpinner = false;
                    this.SaveButtonAccees = true;
                    const noOfRecords = result.length;

                     // Reset selected leads and counts
                    this.noOfSelectedRecords = 0;
                    this.selectedLeads = [];

                     // Refresh the lead data from the server and update record count
                     refreshApex(this.refreshData).then(() => {
                        // Update other things after refresh
                        const refreshDataSize = this.refreshData.data.length; // Ensure you are getting the correct data after refresh
                        this.currentNumber = refreshDataSize;
                    });

                    let ShowMessage = '';

                    if (noOfRecords === 1) {
                        ShowMessage = `1 Lead converted successfully`;
                    } else if (noOfRecords > 1) {
                        ShowMessage = `${noOfRecords} Leads converted successfully`;
                    }
                    
                    if (noOfRecords > 0) {
                        this.showToastMessage('Convert Suceesfully', ShowMessage, 'success');
                        this.basicCannon(); // Cannonball effect when lead conversion successfully
                    }
                })
                .catch(error => {

                    this.showToastMessage('Error', `Error converting leads: ${error.body.message}`, 'error');
                });
        } else {

            this.showToastMessage('Access Denied',`You do not have permission to convert leads.`, 'error');

        }
    }

    // function to show toast message
   async showToastMessage(title, message, variant){
      await  this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    // Method to start the automatic counter
    startCounting() {
        const intervalId = setInterval(() => {
            if (this.currentNumber < this.recordSize) {
                this.currentNumber += 1; // Increment the number
            } else {
                clearInterval(intervalId); // Stop the counter at recordSize
            }
        }, 0.0000000000001); // Update every second (1000 ms)
    }

    // when user click on convert button then this effect will be shown
    basicCannon(){
        // Fire confetti with smaller particle counts in each frame
            confetti({
            particleCount: 900,
            startVelocity: 70,
            spread: 150,
            origin:{
              y: 0.9
                },
              });
            }
}
