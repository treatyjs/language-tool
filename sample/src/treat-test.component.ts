import { Component, signal } from '@angular/core'

@Component({
    standalone: true,
    selector: 'test',
    templateUrl: './treat-test.component.html',
    
})
export class ExampleComponent {
    counter = signal(0);
    run() {
        console.log('test')
    }
}
