package in.srcenterprises.api;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.List;
@RestController @RequestMapping("/api/admin/scheme-drafts")
public class SchemeDraftController {
 private final SchemeDraftRepository repository;
 public SchemeDraftController(SchemeDraftRepository repository){this.repository=repository;}
 @GetMapping public List<SchemeDraft> list(){return repository.findAll();}
 @PostMapping public ResponseEntity<SchemeDraft> create(@Valid @RequestBody SchemeDraft input){
   input.id=null;input.version=null;input.complianceApproved=false;
   var result=repository.save(input);return ResponseEntity.created(URI.create("/api/admin/scheme-drafts/"+result.id)).body(result);
 }
 @PutMapping("/{id}") public SchemeDraft update(@PathVariable Long id,@Valid @RequestBody SchemeDraft input){
   var value=repository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
   value.name=input.name;value.durationMonths=input.durationMonths;value.frequency=input.frequency;
   value.contributionAmount=input.contributionAmount;value.internalNotes=input.internalNotes;
   // No admin API may approve or activate fireworks subscriptions.
   value.complianceApproved=false;return repository.save(value);
 }
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){
   if(!repository.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
   repository.deleteById(id);return ResponseEntity.noContent().build();
 }
}
