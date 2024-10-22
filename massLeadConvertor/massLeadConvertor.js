import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { getRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import leadRecords from '@salesforce/apex/LeadConvertorController.fetchleads';
import Seleted_leadRecords from '@salesforce/apex/LeadConvertorController.SelectedleadsReturn';
import leadConvertIds from '@salesforce/apex/LeadConvertorController.convertLead';
import USER_PROFILE_NAME from '@salesforce/schema/User.Profile.Name';
import USER_ID from '@salesforce/user/Id';

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
    @track searchKey = '';          // To hold the search input
    @track allCheckboxSelected = false; // To check if all checkboxes are selected
    @track orgUrl;
    @track showSpinner = false;

    connectedCallback() {
        // Get the current org URL using window.location.origin
        this.orgUrl = window.location.origin;
        console.log(this.orgUrl);
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

     // Function to handle the search input change
     searchInput(event) {
        this.searchKey = event.target.value; // Store the search key
        console.log(this.searchKey);
    }

    // Function to handle the search button click
    handleSearchButtonClick() {
        const searchKey = this.searchKey.toLowerCase(); // Case-insensitive search

        if (searchKey) {
            const leadRecords = this.records.filter(record => {
                return record.Name.toLowerCase().includes(searchKey);
            });

            // Update the filtered records for display
            this.filteredData = leadRecords;
        } else {
            // Reset filteredData if search input is empty
            this.filteredData = [...this.records];
        }
    }

    // Example: You can also automatically update on input change without pressing the search button
    handleSearchInputChange(event) {
        this.searchKey = event.target.value;
        this.handleSearchButtonClick(); // Trigger filtering immediately after input change
    }

    // Handle individual checkbox selection
    checkbox(event) {
        const checkboxInput = event.target.checked;
        const LeadId = event.target.dataset.id;

        if (checkboxInput) {
            if (!this.selectedLeads.includes(LeadId)) {
                this.selectedLeads.push(LeadId);
            }
        } else {
            const index = this.selectedLeads.indexOf(LeadId);
            if (index !== -1) {
                this.selectedLeads.splice(index, 1);
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
         await checkboxInputs.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedLeads.push(checkbox.dataset.id);
            });
        } else {
            this.selectedLeads = [];
           await checkboxInputs.forEach(checkbox => {
                checkbox.checked = false;
                this.selectedLeads.splice(this.selectedLeads.indexOf(checkbox.dataset.id), 1);
            });
        }

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
        
        if (this.userProfile === 'System Administrator' || this.userProfile === 'Standard User Copy') {
            console.log('Selected Records ===> ' + JSON.stringify(this.selectedLeads));
            console.log('uniqueLeads Records ===> ' + JSON.stringify(this.uniqueLeads));

          await leadConvertIds({ leads: this.uniqueLeads })
                .then(result => {
                    this.showSpinner = false;
                    this.SaveButtonAccees = true;
                    const noOfRecords = result.length;
                    
                    let ShowMessage = '';

                    if (noOfRecords === 1) {
                        ShowMessage = `1 Lead converted successfully`;
                    } else if (noOfRecords > 1) {
                        ShowMessage = `${noOfRecords} Leads converted successfully`;
                    }
                    
                    if (noOfRecords > 0) {
                        refreshApex(this.refreshData);
                        this.showToastMessage('Convert Suceesfully', ShowMessage, 'success');
                    }
                })
                .catch(error => {

                    this.showToastMessage('Error', `Error converting leads: ${error.body.message}`, 'error');
                });
        } else {

            this.showToastMessage('Access Denied',`You do not have permission to convert leads.`, 'error');

        }
    }

   async showToastMessage(title, message, variant){
      await  this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }

    // Navigate to the lead view page
    handlenavigateToLeadViewPage(evt) {
        const leadId = evt.currentTarget.dataset.id;
        
         // Define the navigation reference
         this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                url: `${this.orgUrl}/${leadId}`,
                // objectApiName: 'Lead',
                // actionName: 'view',
                // recordId: leadId,
            }
        })
    }
           // window.open(`${this.orgUrl}/${leadId}`);
    

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
}