import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  dateString : string = "Initial"

	constructor() {
		setInterval(() => {
			this.formatDateString(new Date())
		}, 1000)
	}

	formatDateString(date : Date) {
		this.dateString = date.toTimeString()
	}
}
