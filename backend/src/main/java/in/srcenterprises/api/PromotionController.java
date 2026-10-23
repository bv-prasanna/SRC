package in.srcenterprises.api;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.List;
@RestController
public class PromotionController {
 private final PromotionRepository repo;
 public PromotionController(PromotionRepository repo){this.repo=repo;}
 @GetMapping("/api/catalog/promotions") public List<Promotion> publicList(){return repo.findByPublishedTrueOrderByIdDesc();}
 @GetMapping("/api/admin/promotions") public List<Promotion> list(){return repo.findAll();}
 @PostMapping("/api/admin/promotions") public ResponseEntity<Promotion> create(@Valid @RequestBody Promotion input){
  check(input);input.id=null;input.version=null;input.informationOnly=true;var p=repo.save(input);
  return ResponseEntity.created(URI.create("/api/admin/promotions/"+p.id)).body(p);
 }
 @PutMapping("/api/admin/promotions/{id}") public Promotion update(@PathVariable Long id,@Valid @RequestBody Promotion input){
  check(input);var p=repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
  p.title=input.title;p.description=input.description;p.category=input.category;p.imageUrl=input.imageUrl;
  p.startsOn=input.startsOn;p.endsOn=input.endsOn;p.published=input.published;p.informationOnly=true;
  return repo.save(p);
 }
 @DeleteMapping("/api/admin/promotions/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){
  if(!repo.existsById(id))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  repo.deleteById(id);return ResponseEntity.noContent().build();
 }
 private void check(Promotion p){
  if(p.startsOn!=null&&p.endsOn!=null&&p.endsOn.isBefore(p.startsOn))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"End must follow start");
  if(p.imageUrl!=null&&!p.imageUrl.isBlank()){try{var u=URI.create(p.imageUrl);if(!"https".equals(u.getScheme())||u.getHost()==null)throw new IllegalArgumentException();}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Image must have HTTPS URL");}}
 }
}